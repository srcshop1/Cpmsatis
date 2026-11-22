-- ============================================================
--  CPM Satış · v4 EKLENTİLERİ
--  Supabase > SQL Editor > New query > tamamını yapıştır > Run
--  schema-v3'ün ÜZERİNE çalıştırılır. Tekrar çalıştırılabilir.
-- ============================================================

-- ---------- 1) ÇOKLU KATEGORİ ----------
alter table public.listings add column if not exists categories text[] not null default '{}';
update public.listings
   set categories = array[category]
 where coalesce(array_length(categories, 1), 0) = 0;
create index if not exists listings_categories_idx on public.listings using gin (categories);

-- ---------- 2) HERKESE AÇIK YETKİLİ ETİKETİ ----------
alter table public.profiles add column if not exists staff_tag text;
alter table public.profiles drop constraint if exists profiles_staff_tag_check;
alter table public.profiles
  add constraint profiles_staff_tag_check check (staff_tag is null or staff_tag in ('owner','moderator'));

update public.profiles p
   set staff_tag = r.role
  from public.user_roles r
 where r.user_id = p.id;

-- ---------- 3) YETKİLİ FONKSİYONLARI ----------
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() <> 'owner' then raise exception 'Sadece kurucu rol verebilir'; end if;
  if p_role not in ('owner','moderator') then raise exception 'Geçersiz rol'; end if;
  insert into public.user_roles (user_id, role, granted_by)
  values (p_user, p_role, auth.uid())
  on conflict (user_id) do update set role = p_role;
  update public.profiles set staff_tag = p_role where id = p_user;
end; $$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

create or replace function public.admin_remove_role(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() <> 'owner' then raise exception 'Sadece kurucu yapabilir'; end if;
  if p_user = auth.uid() then raise exception 'Kendi rolünü kaldıramazsın'; end if;
  delete from public.user_roles where user_id = p_user;
  update public.profiles set staff_tag = null where id = p_user;
end; $$;
grant execute on function public.admin_remove_role(uuid) to authenticated;

-- Ban / ban kaldır
create or replace function public.admin_set_banned(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_user = auth.uid() then raise exception 'Kendini banlayamazsın'; end if;
  if (select role from public.user_roles where user_id = p_user) = 'owner' then
    raise exception 'Kurucu banlanamaz';
  end if;
  update public.profiles set banned = p_banned where id = p_user;
  if p_banned then
    update public.listings set status = 'hidden' where seller_id = p_user and status = 'active';
  end if;
end; $$;
grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;

-- Hesabı sil (profil + ilanları + mesajları cascade ile gider)
create or replace function public.admin_delete_account(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() <> 'owner' then raise exception 'Sadece kurucu silebilir'; end if;
  if p_user = auth.uid() then raise exception 'Kendi hesabını silemezsin'; end if;
  if (select role from public.user_roles where user_id = p_user) = 'owner' then
    raise exception 'Kurucu hesabı silinemez';
  end if;
  delete from public.profiles where id = p_user;
end; $$;
grant execute on function public.admin_delete_account(uuid) to authenticated;

-- İlanı öne çıkar / gizle
create or replace function public.admin_feature_listing(p_listing uuid, p_days integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  update public.listings
     set featured_until = now() + make_interval(days => greatest(1, least(p_days, 30)))
   where id = p_listing;
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

-- ---------- 4) BANLI KULLANICI YENİ İLAN AÇAMASIN ----------
create or replace function public.block_banned_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select banned from public.profiles where id = new.seller_id) then
    raise exception 'Hesabınız kısıtlandığı için ilan oluşturamazsınız';
  end if;
  return new;
end; $$;

drop trigger if exists listings_block_banned on public.listings;
create trigger listings_block_banned before insert on public.listings
for each row execute function public.block_banned_listing();

-- ---------- 4b) İLAN SÜRESİ: 15 GÜN ----------
-- Süresi dolan ilanlar listeden kalkar (sahibi "Yenile" ile tekrar yayınlar)
create or replace function public.expire_listings()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.listings
     set status = 'hidden'
   where status = 'active'
     and created_at < now() - interval '15 days';
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.expire_listings() to anon, authenticated;

create or replace function public.renew_listing(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.listings where id = p_listing and seller_id = auth.uid()
  ) then
    raise exception 'Bu ilanın sahibi değilsin';
  end if;
  if (select banned from public.profiles where id = auth.uid()) then
    raise exception 'Hesabınız kısıtlandığı için ilan yenilenemez';
  end if;
  update public.listings set created_at = now(), status = 'active' where id = p_listing;
end; $$;
grant execute on function public.renew_listing(uuid) to authenticated;

-- ---------- 5) DEPOLAMA (avatar / ilan görselleri) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars',true,4194304, array['image/jpeg','image/png','image/webp','image/jpg'])
on conflict (id) do update set public = true, file_size_limit = 4194304;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images','listing-images',true,8388608,
        array['image/jpeg','image/png','image/webp','image/gif','image/jpg'])
on conflict (id) do update set public = true, file_size_limit = 8388608;

drop policy if exists "Kullanıcı kendi klasörüne yükler" on storage.objects;
create policy "Kullanıcı kendi klasörüne yükler" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-images','avatars')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Kullanıcı kendi görselini günceller" on storage.objects;
create policy "Kullanıcı kendi görselini günceller" on storage.objects for update to authenticated
  using (bucket_id in ('listing-images','avatars')
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('listing-images','avatars')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Görseller herkese açık" on storage.objects;
create policy "Görseller herkese açık" on storage.objects for select
  using (bucket_id in ('listing-images','avatars'));

-- ---------- 5b) DUYURU SİLME (kurucu) ----------
alter table public.announcements enable row level security;

drop policy if exists "Duyuru herkese açık" on public.announcements;
create policy "Duyuru herkese açık" on public.announcements for select using (true);

drop policy if exists "Duyuru yazma kurucu" on public.announcements;
create policy "Duyuru yazma kurucu" on public.announcements for insert to authenticated
  with check (public.my_staff_role() = 'owner');

drop policy if exists "Duyuru silme kurucu" on public.announcements;
create policy "Duyuru silme kurucu" on public.announcements for delete to authenticated
  using (public.my_staff_role() = 'owner');

-- ---------- 5c) ÇERÇEVE VERME ----------
create table if not exists public.user_frames (
  user_id uuid not null references public.profiles (id) on delete cascade,
  frame text not null check (frame in ('member','verified_seller','vip','premium','moderator','owner')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, frame)
);
alter table public.user_frames enable row level security;

drop policy if exists "Çerçeve herkese açık" on public.user_frames;
create policy "Çerçeve herkese açık" on public.user_frames for select using (true);
drop policy if exists "Çerçeve verme yetkili" on public.user_frames;
create policy "Çerçeve verme yetkili" on public.user_frames for insert to authenticated
  with check (public.is_staff());
drop policy if exists "Çerçeve silme yetkili" on public.user_frames;
create policy "Çerçeve silme yetkili" on public.user_frames for delete to authenticated
  using (public.is_staff());

create or replace function public.admin_set_frame(p_user uuid, p_frame text, p_remove boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_frame not in ('member','verified_seller','vip','premium','moderator','owner') then
    raise exception 'Geçersiz çerçeve';
  end if;
  if p_remove then
    delete from public.user_frames where user_id = p_user and frame = p_frame;
  else
    insert into public.user_frames (user_id, frame, granted_by)
    values (p_user, p_frame, auth.uid())
    on conflict (user_id, frame) do nothing;
  end if;
end; $$;
grant execute on function public.admin_set_frame(uuid, text, boolean) to authenticated;

-- ---------- 5d) YETKİLİ BİLDİRİMİ + KAYIT SİLME ----------
drop policy if exists "Bildirim ekle yetkili" on public.notifications;
create policy "Bildirim ekle yetkili" on public.notifications for insert to authenticated
  with check (public.is_staff());

drop policy if exists "Bildirim silme yetkili" on public.notifications;
create policy "Bildirim silme yetkili" on public.notifications for delete to authenticated
  using (public.is_staff());

create or replace function public.admin_notify(
  p_user uuid,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_kind text default 'staff'
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Başlık gerekli'; end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (
    p_user,
    coalesce(nullif(btrim(p_kind), ''), 'staff'),
    left(btrim(p_title), 120),
    p_body,
    p_link
  );
end; $$;
grant execute on function public.admin_notify(uuid, text, text, text, text) to authenticated;

drop policy if exists "Talep silme yetkili" on public.support_tickets;
create policy "Talep silme yetkili" on public.support_tickets for delete to authenticated
  using (public.is_staff());

drop policy if exists "Başvuru silme yetkili" on public.seller_applications;
create policy "Başvuru silme yetkili" on public.seller_applications for delete to authenticated
  using (public.is_staff());

drop policy if exists "Öne çıkarma silme yetkili" on public.featured_requests;
create policy "Öne çıkarma silme yetkili" on public.featured_requests for delete to authenticated
  using (public.is_staff());

-- ---------- 5e) MESAJ OKUNDU + PUAN DÜZELTME ----------
alter table public.messages add column if not exists read_at timestamptz;

drop policy if exists "Mesaj okundu işaretle" on public.messages;
create policy "Mesaj okundu işaretle" on public.messages for update to authenticated
  using (
    sender_id <> auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  )
  with check (
    sender_id <> auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  );

-- Değerlendirmesi olmayan kullanıcı 5 yıldız görünmesin
alter table public.profiles alter column rating set default 0;
update public.profiles p
   set rating = coalesce(
         (select round(avg(r.overall)::numeric, 2) from public.reviews r where r.seller_id = p.id),
         0
       ),
       review_count = (select count(*) from public.reviews r where r.seller_id = p.id);

-- ---------- 5f) MESAJ YANITI (ALINTI) ----------
alter table public.messages add column if not exists reply_to jsonb;

-- ---------- 5g) KULLANICI ENGELLEME ----------
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;

drop policy if exists "Engel kendi" on public.user_blocks;
create policy "Engel kendi" on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());
drop policy if exists "Engel ekle kendi" on public.user_blocks;
create policy "Engel ekle kendi" on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());
drop policy if exists "Engel sil kendi" on public.user_blocks;
create policy "Engel sil kendi" on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

drop policy if exists "Mesaj gönderme" on public.messages;
create policy "Mesaj gönderme" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
        and not public.is_blocked_between(c.user_a, c.user_b)
    )
  );

-- ---------- 6) ÖNBELLEK ----------
notify pgrst, 'reload schema';

select
  (select count(*) from public.listings where coalesce(array_length(categories,1),0) > 0) as "kategorili ilan",
  (select count(*) from public.profiles where staff_tag is not null) as "yetkili etiketli profil";
