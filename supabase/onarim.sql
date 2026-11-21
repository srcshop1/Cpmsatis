-- ============================================================
--  CPM Satış · HIZLI ONARIM
--  Ne zaman: "Could not find the function public.admin_set_tag ... in the schema cache"
--            ya da yetkili panelindeki butonlar hata veriyorsa.
--  Nerede:   Supabase > SQL Editor > New query > tamamını yapıştır > Run
--  Not:      Tekrar tekrar çalıştırılabilir, veri silmez.
-- ============================================================

-- ---------- 1) GEREKLİ KOLONLAR ----------
alter table public.profiles add column if not exists verified_seller boolean not null default false;
alter table public.profiles add column if not exists review_count integer not null default 0;
alter table public.profiles add column if not exists equipped_frame text;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists banned boolean not null default false;

-- ---------- 2) ROLLER ----------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner','moderator')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

create or replace function public.my_staff_role() returns text
language sql security definer stable set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;
grant execute on function public.my_staff_role() to authenticated;

create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;
grant execute on function public.is_staff() to authenticated;

-- ---------- 3) TAGLAR ----------
create table if not exists public.user_tags (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tag text not null check (tag in ('vip','premium','verified_seller')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, tag)
);
alter table public.user_tags enable row level security;

drop policy if exists "Tag herkese açık" on public.user_tags;
create policy "Tag herkese açık" on public.user_tags for select using (true);
drop policy if exists "Tag verme yetkili" on public.user_tags;
create policy "Tag verme yetkili" on public.user_tags for insert to authenticated
  with check (public.is_staff());
drop policy if exists "Tag silme yetkili" on public.user_tags;
create policy "Tag silme yetkili" on public.user_tags for delete to authenticated
  using (public.is_staff());

create or replace function public.admin_set_tag(p_user uuid, p_tag text, p_remove boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_tag not in ('vip','premium','verified_seller') then raise exception 'Geçersiz tag'; end if;

  if p_remove then
    delete from public.user_tags where user_id = p_user and tag = p_tag;
    if p_tag = 'verified_seller' then
      update public.profiles set verified_seller = false where id = p_user;
    end if;
  else
    insert into public.user_tags (user_id, tag, granted_by)
    values (p_user, p_tag, auth.uid())
    on conflict (user_id, tag) do nothing;
    if p_tag = 'verified_seller' then
      update public.profiles set verified_seller = true where id = p_user;
    end if;
  end if;
end; $$;
grant execute on function public.admin_set_tag(uuid, text, boolean) to authenticated;

-- ---------- 4) YETKİLİ ATAMA ----------
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() <> 'owner' then raise exception 'Sadece kurucu rol verebilir'; end if;
  if p_role not in ('owner','moderator') then raise exception 'Geçersiz rol'; end if;
  insert into public.user_roles (user_id, role, granted_by)
  values (p_user, p_role, auth.uid())
  on conflict (user_id) do update set role = p_role;
end; $$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ---------- 5) BİLDİRİMLER ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

drop policy if exists "Bildirimler kendi" on public.notifications;
create policy "Bildirimler kendi" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "Bildirim güncelle kendi" on public.notifications;
create policy "Bildirim güncelle kendi" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Bildirim sil kendi" on public.notifications;
create policy "Bildirim sil kendi" on public.notifications for delete using (user_id = auth.uid());

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, p_title, p_body, p_link);
$$;
revoke all on function public.notify(uuid,text,text,text,text) from public;

-- ---------- 6) KULLANICI ADIYLA GİRİŞ ----------
create or replace function public.email_for_username(uname text)
returns text language sql security definer stable set search_path = public, auth as $$
  select u.email::text
  from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(uname)) limit 1;
$$;
revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ---------- 7) KURUCU ----------
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where lower(email) = 'srcuveys@gmail.com'
on conflict (user_id) do update set role = 'owner';

-- ---------- 8) ÖNBELLEĞİ YENİLE + KONTROL ----------
notify pgrst, 'reload schema';

select proname as "fonksiyon", 'hazır' as "durum"
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('my_staff_role','is_staff','email_for_username','notify',
                  'admin_set_tag','admin_set_role')
order by 1;
