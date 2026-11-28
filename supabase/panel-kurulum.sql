-- =====================================================================
--  YETKİLİ PANELİ TAM KURULUM  (tek dosya, tekrar çalıştırılabilir)
--  Supabase > SQL Editor içine yapıştırıp bir kez çalıştır.
--  Paneldeki tüm işlemleri (silme, askı, rol, etiket, çerçeve, duyuru,
--  öne çıkarma, vitrin, satış, bildirim) veritabanı tarafında kurar.
-- =====================================================================

-- ---------- 0) Gerekli kolonlar ----------
alter table public.profiles add column if not exists staff_tag text;
alter table public.profiles add column if not exists verified_seller boolean not null default false;
alter table public.profiles add column if not exists equipped_frame text not null default 'member';
alter table public.profiles add column if not exists sales_count integer not null default 0;
alter table public.profiles add column if not exists banned boolean not null default false;
alter table public.profiles add column if not exists banned_until timestamptz;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists banned_by uuid references public.profiles (id) on delete set null;

alter table public.listings add column if not exists featured_until timestamptz;
alter table public.sales add column if not exists counted boolean not null default true;
alter table public.sales add column if not exists flag_reason text;

-- ---------- 1) Tablolar ----------
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner','moderator')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create table if not exists public.user_tags (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tag text not null check (tag in ('vip','premium','verified_seller')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, tag)
);

create table if not exists public.user_frames (
  user_id uuid not null references public.profiles (id) on delete cascade,
  frame text not null check (frame in ('member','verified_seller','vip','premium','moderator','owner')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, frame)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'staff',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_showcase (
  week_start date not null,
  position smallint not null check (position between 1 and 3),
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (week_start, position)
);

alter table public.user_roles enable row level security;
alter table public.user_tags enable row level security;
alter table public.user_frames enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.staff_showcase enable row level security;

-- ---------- 2) Yetki fonksiyonları ----------
create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;
grant execute on function public.is_staff() to authenticated;

create or replace function public.my_staff_role() returns text
language sql security definer stable set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;
grant execute on function public.my_staff_role() to authenticated;

-- ---------- 3) RLS: okuma ----------
drop policy if exists "Roller okunur" on public.user_roles;
create policy "Roller okunur" on public.user_roles for select to authenticated using (true);

drop policy if exists "Tag herkese açık" on public.user_tags;
create policy "Tag herkese açık" on public.user_tags for select using (true);

drop policy if exists "Çerçeve herkese açık" on public.user_frames;
create policy "Çerçeve herkese açık" on public.user_frames for select using (true);

drop policy if exists "Duyuru herkese açık" on public.announcements;
create policy "Duyuru herkese açık" on public.announcements for select using (true);

drop policy if exists "staff showcase read" on public.staff_showcase;
create policy "staff showcase read" on public.staff_showcase for select using (true);

drop policy if exists "Bildirimler kendi" on public.notifications;
create policy "Bildirimler kendi" on public.notifications for select using (user_id = auth.uid());

-- ---------- 4) RLS: panelin doğrudan yazabilmesi ----------
drop policy if exists "Yetkili profil günceller" on public.profiles;
create policy "Yetkili profil günceller" on public.profiles for update
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Yetkili profil siler" on public.profiles;
create policy "Yetkili profil siler" on public.profiles for delete using (public.is_staff());

drop policy if exists "Yetkili rol yazar" on public.user_roles;
create policy "Yetkili rol yazar" on public.user_roles for all
  using (public.my_staff_role() = 'owner') with check (public.my_staff_role() = 'owner');

drop policy if exists "Yetkili tag yazar" on public.user_tags;
create policy "Yetkili tag yazar" on public.user_tags for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Yetkili çerçeve yazar" on public.user_frames;
create policy "Yetkili çerçeve yazar" on public.user_frames for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Yetkili bildirim yazar" on public.notifications;
create policy "Yetkili bildirim yazar" on public.notifications for insert to authenticated
  with check (public.is_staff());

drop policy if exists "Yetkili duyuru yazar" on public.announcements;
create policy "Yetkili duyuru yazar" on public.announcements for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Yetkili vitrin yazar" on public.staff_showcase;
create policy "Yetkili vitrin yazar" on public.staff_showcase for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Yetkili ilan günceller" on public.listings;
create policy "Yetkili ilan günceller" on public.listings for update
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Yetkili ilan siler" on public.listings;
create policy "Yetkili ilan siler" on public.listings for delete using (public.is_staff());

drop policy if exists "Yetkili satış günceller" on public.sales;
create policy "Yetkili satış günceller" on public.sales for update
  using (public.is_staff()) with check (public.is_staff());

-- ---------- 5) Askı ----------
create or replace function public.ban_active(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.banned and (p.banned_until is null or p.banned_until > now())
      from public.profiles p where p.id = p_user
  ), false);
$$;
grant execute on function public.ban_active(uuid) to anon, authenticated;

create or replace function public.expire_bans()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  update public.profiles
     set banned = false, banned_until = null, ban_reason = null, banned_by = null
   where banned and banned_until is not null and banned_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.expire_bans() to authenticated;

drop function if exists public.admin_set_banned(uuid, boolean);
drop function if exists public.admin_set_banned(uuid, boolean, integer);

create or replace function public.admin_set_banned(
  p_user uuid,
  p_banned boolean,
  p_days integer default null,
  p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_user = auth.uid() then raise exception 'Kendini askıya alamazsın'; end if;
  if (select role from public.user_roles where user_id = p_user) = 'owner' then
    raise exception 'Kurucu askıya alınamaz';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  if p_banned then
    update public.profiles
       set banned = true,
           banned_until = case
             when p_days is null or p_days <= 0 then null
             else now() + make_interval(days => least(greatest(p_days, 1), 3650))
           end,
           ban_reason = nullif(trim(coalesce(p_reason, '')), ''),
           banned_by = auth.uid()
     where id = p_user;

    update public.listings set status = 'hidden'
     where seller_id = p_user and status = 'active';
  else
    update public.profiles
       set banned = false, banned_until = null, ban_reason = null, banned_by = null
     where id = p_user;
  end if;
end; $$;
grant execute on function public.admin_set_banned(uuid, boolean, integer, text) to authenticated;

-- ---------- 6) Rol ----------
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'Sadece kurucu rol verebilir'; end if;
  if p_role not in ('owner','moderator') then raise exception 'Geçersiz rol'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Kullanıcı bulunamadı'; end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user, p_role, auth.uid())
  on conflict (user_id) do update set role = p_role, granted_by = auth.uid();

  update public.profiles set staff_tag = p_role where id = p_user;
end; $$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

create or replace function public.admin_remove_role(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'Sadece kurucu yapabilir'; end if;
  if p_user = auth.uid() then raise exception 'Kendi rolünü kaldıramazsın'; end if;
  delete from public.user_roles where user_id = p_user;
  update public.profiles set staff_tag = null where id = p_user;
end; $$;
grant execute on function public.admin_remove_role(uuid) to authenticated;

-- ---------- 7) Etiket ----------
create or replace function public.admin_set_tag(p_user uuid, p_tag text, p_remove boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_tag not in ('vip','premium','verified_seller') then raise exception 'Geçersiz etiket'; end if;

  if p_remove then
    delete from public.user_tags where user_id = p_user and tag = p_tag;
  else
    insert into public.user_tags (user_id, tag, granted_by)
    values (p_user, p_tag, auth.uid())
    on conflict (user_id, tag) do nothing;
  end if;

  if p_tag = 'verified_seller' then
    update public.profiles set verified_seller = not p_remove where id = p_user;
  end if;
end; $$;
grant execute on function public.admin_set_tag(uuid, text, boolean) to authenticated;

-- ---------- 8) Çerçeve ----------
create or replace function public.admin_set_frame(
  p_user uuid,
  p_frame text,
  p_remove boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_frame not in ('member','verified_seller','vip','premium','moderator','owner') then
    raise exception 'Geçersiz çerçeve';
  end if;
  if public.my_staff_role() is distinct from 'owner' then
    raise exception 'Çerçeve verme yetkisi sadece kurucudadır';
  end if;

  if p_remove then
    delete from public.user_frames where user_id = p_user and frame = p_frame;
    update public.profiles set equipped_frame = 'member'
     where id = p_user and equipped_frame = p_frame;
  else
    insert into public.user_frames (user_id, frame, granted_by)
    values (p_user, p_frame, auth.uid())
    on conflict (user_id, frame) do nothing;
  end if;
end; $$;
grant execute on function public.admin_set_frame(uuid, text, boolean) to authenticated;

-- ---------- 9) İlan işlemleri ----------
create or replace function public.admin_feature_listing(p_listing uuid, p_days integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  update public.listings
     set featured_until = now() + make_interval(days => greatest(1, least(coalesce(p_days, 1), 30)))
   where id = p_listing;
  if not found then raise exception 'İlan bulunamadı'; end if;
end; $$;
grant execute on function public.admin_feature_listing(uuid, integer) to authenticated;

create or replace function public.admin_set_listing_status(p_listing uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_status not in ('active','hidden','removed','sold') then raise exception 'Geçersiz durum'; end if;
  update public.listings set status = p_status where id = p_listing;
end; $$;
grant execute on function public.admin_set_listing_status(uuid, text) to authenticated;

-- ---------- 10) Bildirim / duyuru ----------
create or replace function public.admin_notify(
  p_user uuid,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_kind text default 'staff'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Başlık gerekli'; end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, coalesce(nullif(btrim(p_kind), ''), 'staff'), left(btrim(p_title), 120), p_body, p_link);
end; $$;
grant execute on function public.admin_notify(uuid, text, text, text, text) to authenticated;

-- ---------- 11) Satış sayacı ----------
create or replace function public.recalc_sales_count(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  select count(*) into v_count from public.sales
   where seller_id = p_user and status = 'approved' and counted;
  update public.profiles set sales_count = v_count where id = p_user;
  return v_count;
end; $$;
grant execute on function public.recalc_sales_count(uuid) to authenticated;

create or replace function public.admin_set_sale_counted(p_sale uuid, p_counted boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_seller uuid;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  update public.sales
     set counted = p_counted,
         flag_reason = case when p_counted then null else coalesce(flag_reason, 'yetkili kararı') end
   where id = p_sale
  returning seller_id into v_seller;
  if v_seller is null then raise exception 'Satış bulunamadı'; end if;
  perform public.recalc_sales_count(v_seller);
end; $$;
grant execute on function public.admin_set_sale_counted(uuid, boolean) to authenticated;

-- ---------- 12) Yetkili vitrini ----------
create or replace function public.admin_set_showcase(p_listing_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_week date := date_trunc('week', now())::date;
  v_count integer := 0;
begin
  if public.my_staff_role() is distinct from 'owner' then
    raise exception 'Yetkili vitrinini sadece kurucu seçebilir';
  end if;

  delete from public.staff_showcase where week_start = v_week;

  if p_listing_ids is null or array_length(p_listing_ids, 1) is null then
    return 0;
  end if;

  insert into public.staff_showcase (week_start, position, listing_id, created_by)
  select v_week, row_number() over (), s.id, auth.uid()
    from (select unnest(p_listing_ids[1:3]) as id) s
   where exists (select 1 from public.listings l where l.id = s.id and l.status = 'active');

  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.admin_set_showcase(uuid[]) to authenticated;

-- ---------- 13) Hesap silme ----------
drop function if exists public.admin_delete_account(uuid);

create or replace function public.admin_delete_account(p_user uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare v_role text;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_user = auth.uid() then raise exception 'Kendi hesabını silemezsin'; end if;

  select role into v_role from public.user_roles where user_id = p_user;
  if v_role = 'owner' then raise exception 'Kurucu hesabı silinemez'; end if;
  if v_role = 'moderator' and public.my_staff_role() is distinct from 'owner' then
    raise exception 'Yetkili hesabını sadece kurucu silebilir';
  end if;

  delete from public.user_roles where user_id = p_user;
  delete from public.listings where seller_id = p_user;
  delete from public.profiles where id = p_user;

  begin
    delete from auth.users where id = p_user;
    return 'auth';
  exception when others then
    return 'profil';
  end;
end; $$;
grant execute on function public.admin_delete_account(uuid) to authenticated;

create or replace function public.admin_purge_orphan_accounts()
returns integer language plpgsql security definer set search_path = public, auth as $$
declare v_count integer := 0;
begin
  if public.my_staff_role() is distinct from 'owner' then
    raise exception 'Sadece kurucu temizleyebilir';
  end if;

  delete from auth.users u
   where not exists (select 1 from public.profiles p where p.id = u.id)
     and u.id <> auth.uid();

  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.admin_purge_orphan_accounts() to authenticated;

-- ---------- 14) Askıdaki hesap engelleri ----------
create or replace function public.guard_banned_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.ban_active(new.seller_id) then
    raise exception 'Hesabın askıda olduğu için ilan ekleyemezsin';
  end if;
  return new;
end; $$;

drop trigger if exists listings_ban_guard on public.listings;
create trigger listings_ban_guard before insert on public.listings
for each row execute function public.guard_banned_listing();

create or replace function public.guard_banned_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.ban_active(new.sender_id) then
    raise exception 'Hesabın askıda olduğu için mesaj gönderemezsin';
  end if;
  return new;
end; $$;

drop trigger if exists messages_ban_guard on public.messages;
create trigger messages_ban_guard before insert on public.messages
for each row execute function public.guard_banned_message();

drop policy if exists "Askıdaki hesap ilan göremez" on public.listings;
create policy "Askıdaki hesap ilan göremez" on public.listings as restrictive for select
  using (not public.ban_active(auth.uid()));

drop policy if exists "Askıdaki hesap sohbet göremez" on public.messages;
create policy "Askıdaki hesap sohbet göremez" on public.messages as restrictive for select
  using (not public.ban_active(auth.uid()));

drop policy if exists "Askıdaki hesap konuşma göremez" on public.conversations;
create policy "Askıdaki hesap konuşma göremez" on public.conversations as restrictive for select
  using (not public.ban_active(auth.uid()));

-- ---------- 15) Şema önbelleğini yenile ----------
notify pgrst, 'reload schema';

-- Bitti. Panel artık çalışmalı.
