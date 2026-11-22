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

-- ---------- 5h) TEK SOHBET + BİLDİRİM TEKRARINI ÖNLE ----------
-- Aynı iki kişi arasındaki çift sohbetleri tek sohbete indir
with ranked as (
  select id,
         first_value(id) over (
           partition by least(user_a, user_b), greatest(user_a, user_b)
           order by created_at, id
         ) as keep_id
  from public.conversations
)
update public.messages m
   set conversation_id = r.keep_id
  from ranked r
 where m.conversation_id = r.id
   and r.id <> r.keep_id;

with ranked as (
  select id,
         first_value(id) over (
           partition by least(user_a, user_b), greatest(user_a, user_b)
           order by created_at, id
         ) as keep_id
  from public.conversations
)
delete from public.conversations c
 using ranked r
 where c.id = r.id
   and r.id <> r.keep_id;

create unique index if not exists conversations_pair_uniq
  on public.conversations (least(user_a, user_b), greatest(user_a, user_b));

-- Aynı bildirim 1 gün içinde ikinci kez eklenmesin
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, p_body, p_link
  where not exists (
    select 1 from public.notifications n
    where n.user_id = p_user
      and n.kind = p_kind
      and n.title is not distinct from p_title
      and n.body is not distinct from p_body
      and n.link is not distinct from p_link
      and n.created_at > now() - interval '1 day'
  );
$$;
revoke all on function public.notify(uuid,text,text,text,text) from public;

-- ---------- 5i) DEĞERLENDİRMEYE CEVAP ----------
alter table public.reviews add column if not exists reply text;
alter table public.reviews add column if not exists replied_at timestamptz;

create or replace function public.reply_review(p_review uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare v_buyer uuid; v_seller uuid; v_title text;
begin
  if coalesce(btrim(p_reply), '') = '' then raise exception 'Cevap boş olamaz'; end if;

  select buyer_id, seller_id into v_buyer, v_seller from public.reviews where id = p_review;
  if v_seller is null or v_seller <> auth.uid() then raise exception 'Yetkisiz'; end if;

  update public.reviews
     set reply = left(btrim(p_reply), 500),
         replied_at = now()
   where id = p_review;

  select username into v_title from public.profiles where id = v_seller;
  perform public.notify(v_buyer, 'review', 'Değerlendirmene yanıt geldi',
           coalesce(v_title, 'Satıcı') || ' değerlendirmene cevap yazdı.', '/profil');
end; $$;
grant execute on function public.reply_review(uuid, text) to authenticated;

-- ---------- 5j) YETKİLİ: DEĞERLENDİRME KALDIRMA ----------
create or replace function public.admin_delete_review(p_review uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_seller uuid; v_by text;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;

  select seller_id into v_seller from public.reviews where id = p_review;
  if v_seller is null then raise exception 'Değerlendirme bulunamadı'; end if;

  delete from public.reviews where id = p_review;

  update public.profiles p set
    rating = (select round(avg(r.overall)::numeric, 2) from public.reviews r where r.seller_id = v_seller),
    review_count = (select count(*) from public.reviews r where r.seller_id = v_seller)
  where p.id = v_seller;

  select username into v_by from public.profiles where id = auth.uid();
  perform public.notify(v_seller, 'review', 'Değerlendirme kaldırıldı',
    coalesce(v_by, 'Yetkili') || ' bir değerlendirmeni kaldırdı.', '/profil');
end; $$;
grant execute on function public.admin_delete_review(uuid) to authenticated;

create or replace function public.admin_clear_reviews(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'Yetkisiz'; end if;

  delete from public.reviews where seller_id = p_user;
  get diagnostics v_count = row_count;

  update public.profiles p set
    rating = (select round(avg(r.overall)::numeric, 2) from public.reviews r where r.seller_id = p_user),
    review_count = (select count(*) from public.reviews r where r.seller_id = p_user)
  where p.id = p_user;

  if v_count > 0 then
    perform public.notify(p_user, 'review', 'Değerlendirmeler kaldırıldı',
      'Profilindeki değerlendirmeler yetkili tarafından kaldırıldı.', '/profil');
  end if;
  return v_count;
end; $$;
grant execute on function public.admin_clear_reviews(uuid) to authenticated;

-- ---------- 5k) KURUCU: PROFİL DÜZENLEME ----------
create or replace function public.admin_set_sales_count(p_user uuid, p_count integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer; v_ok boolean;
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'Yetkisiz'; end if;

  v_count := greatest(0, least(999999, coalesce(p_count, 0)));
  update public.profiles set sales_count = v_count where id = p_user;
  v_ok := found;
  if not v_ok then raise exception 'Kullanıcı bulunamadı'; end if;

  perform public.notify(p_user, 'staff', 'Profilin güncellendi',
    'Başarılı işlem sayın ' || v_count || ' olarak düzenlendi.', '/profil');
  return v_count;
end; $$;
grant execute on function public.admin_set_sales_count(uuid, integer) to authenticated;

create or replace function public.admin_sync_sales_count(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'Yetkisiz'; end if;

  select count(*) into v_count from public.sales
   where seller_id = p_user and status = 'approved';

  update public.profiles set sales_count = v_count where id = p_user;
  return v_count;
end; $$;
grant execute on function public.admin_sync_sales_count(uuid) to authenticated;

-- ---------- 5l) MESAJ GÖNDERME (SUNUCU TARAFI YEDEK) ----------
create or replace function public.send_message(
  p_conversation uuid,
  p_body text,
  p_listing_ref jsonb default null,
  p_reply_to jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_me uuid := auth.uid(); v_body text;
begin
  if v_me is null then raise exception 'Oturum gerekli'; end if;

  if not exists (
    select 1 from public.conversations c
     where c.id = p_conversation and (c.user_a = v_me or c.user_b = v_me)
  ) then
    raise exception 'Bu sohbete mesaj gönderemiyorsun';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if v_body = '' then raise exception 'Mesaj boş olamaz'; end if;

  insert into public.messages (conversation_id, sender_id, body, listing_ref, reply_to)
  values (p_conversation, v_me, left(v_body, 4000), p_listing_ref, p_reply_to)
  returning id into v_id;

  return v_id;
end; $$;
grant execute on function public.send_message(uuid, text, jsonb, jsonb) to authenticated;

-- ---------- 5m) CANLI MESAJ (REALTIME) ----------
-- NOT: ALTER PUBLICATION plpgsql içinde doğrudan çalışmaz, EXECUTE gerekir.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
  end if;
exception when others then
  -- Realtime kurulamazsa mesajlaşma yine çalışır (yoklama devrede)
  null;
end $$;

-- ---------- 5n) BİLDİRİ NOTU ----------
alter table public.reports add column if not exists admin_note text;

-- ---------- 5o) YETKİLİ: SOHBETİ TAMAMEN TEMİZLE ----------
create or replace function public.admin_clear_conversation(p_conversation uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; v_a uuid; v_b uuid; v_by text;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;

  select user_a, user_b into v_a, v_b from public.conversations where id = p_conversation;
  if v_a is null then raise exception 'Sohbet bulunamadı'; end if;

  delete from public.messages where conversation_id = p_conversation;
  get diagnostics v_count = row_count;

  update public.conversations set last_message_at = now() where id = p_conversation;

  select username into v_by from public.profiles where id = auth.uid();

  perform public.notify(v_a, 'staff', 'Sohbet temizlendi',
    coalesce(v_by, 'Yetkili') || ' bu sohbetin mesajlarını temizledi.', '/mesajlar');
  if v_b is distinct from v_a then
    perform public.notify(v_b, 'staff', 'Sohbet temizlendi',
      coalesce(v_by, 'Yetkili') || ' bu sohbetin mesajlarını temizledi.', '/mesajlar');
  end if;

  return v_count;
end; $$;
grant execute on function public.admin_clear_conversation(uuid) to authenticated;

-- ---------- 6) ÖNBELLEK ----------
notify pgrst, 'reload schema';

select
  (select count(*) from public.listings where coalesce(array_length(categories,1),0) > 0) as "kategorili ilan",
  (select count(*) from public.profiles where staff_tag is not null) as "yetkili etiketli profil";
