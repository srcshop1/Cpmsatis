-- ============================================================
--  CPM Satış — SON EKLER (yalnızca yeni özellikler)
--  Bu dosya da idempotenttir; HEPSI.sql yerine tek başına çalıştırılabilir.
--  İçerik: bildiri notu, değerlendirme kaldırma, başarılı işlem sayısı,
--  sunucu tarafı mesaj gönderme, canlı mesaj (realtime) ve sohbet temizleme.
-- ============================================================

-- Bildiriye yetkili notu
alter table public.reports add column if not exists admin_note text;

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


-- ---------- 5p) DEĞERLENDİRME SİLİNİNCE PUAN DÜZELTME ----------
create or replace function public.after_review_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p set
    rating = (select round(avg(r.overall)::numeric, 2) from public.reviews r where r.seller_id = old.seller_id),
    review_count = (select count(*) from public.reviews r where r.seller_id = old.seller_id)
  where p.id = old.seller_id;
  return old;
end; $$;

drop trigger if exists reviews_after_delete on public.reviews;
create trigger reviews_after_delete after delete on public.reviews
for each row execute function public.after_review_delete();

-- Mevcut kayıtları bir kez düzelt (puanı kalmış ama değerlendirmesi silinmiş profiller)
update public.profiles p set
  rating = (select round(avg(r.overall)::numeric, 2) from public.reviews r where r.seller_id = p.id),
  review_count = (select count(*) from public.reviews r where r.seller_id = p.id)
where coalesce(p.review_count, 0) <> (
        select count(*) from public.reviews r where r.seller_id = p.id
      )
   or (select count(*) from public.reviews r where r.seller_id = p.id) = 0
      and coalesce(p.rating, 0) <> 0;


-- ---------- 5q) YETKİLİ: HESAP SİLME (giriş hesabı dahil) ----------
-- Hesabı sil (giriş hesabı + profil + ilanlar + mesajlar + tüm veriler)
create or replace function public.admin_delete_account(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_role text;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_user = auth.uid() then raise exception 'Kendi hesabını silemezsin'; end if;

  select role into v_role from public.user_roles where user_id = p_user;
  if v_role = 'owner' then raise exception 'Kurucu hesabı silinemez'; end if;
  if v_role = 'moderator' and public.my_staff_role() <> 'owner' then
    raise exception 'Yetkili hesabını sadece kurucu silebilir';
  end if;

  -- Giriş hesabını sil: profil ve tüm veriler cascade ile gider
  begin
    delete from auth.users where id = p_user;
  exception when others then
    null;
  end;

  -- Giriş hesabı silinemediyse en azından profili kaldır
  delete from public.profiles where id = p_user;
end; $$;
grant execute on function public.admin_delete_account(uuid) to authenticated;


-- ---------- 5r) İLAN: GÖRÜNTÜLENME + FAVORİ ----------
alter table public.listings add column if not exists view_count integer not null default 0;
alter table public.listings add column if not exists favorite_count integer not null default 0;

create table if not exists public.listing_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists listing_favorites_listing_idx
  on public.listing_favorites (listing_id);

alter table public.listing_favorites enable row level security;

drop policy if exists listing_favorites_read on public.listing_favorites;
create policy listing_favorites_read on public.listing_favorites
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists listing_favorites_add on public.listing_favorites;
create policy listing_favorites_add on public.listing_favorites
  for insert with check (user_id = auth.uid());

drop policy if exists listing_favorites_remove on public.listing_favorites;
create policy listing_favorites_remove on public.listing_favorites
  for delete using (user_id = auth.uid());

-- Favori sayısını ilanın üzerinde tut
create or replace function public.sync_listing_favorite_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_listing uuid;
begin
  v_listing := coalesce(new.listing_id, old.listing_id);
  update public.listings l
     set favorite_count = (select count(*) from public.listing_favorites f where f.listing_id = v_listing)
   where l.id = v_listing;
  return coalesce(new, old);
end; $$;

drop trigger if exists listing_favorites_count on public.listing_favorites;
create trigger listing_favorites_count
  after insert or delete on public.listing_favorites
  for each row execute function public.sync_listing_favorite_count();

-- Görüntülenme sayacı (giriş yapmadan da çalışır)
create or replace function public.increment_listing_view(p_listing uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.listings
     set view_count = coalesce(view_count, 0) + 1
   where id = p_listing
  returning view_count into v_count;
  return coalesce(v_count, 0);
end; $$;
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

-- Favoriye ekle / çıkar (true = eklendi)
create or replace function public.toggle_listing_favorite(p_listing uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_exists boolean;
begin
  if auth.uid() is null then raise exception 'Favorilemek için giriş yapmalısın'; end if;

  select exists(
    select 1 from public.listing_favorites
     where user_id = auth.uid() and listing_id = p_listing
  ) into v_exists;

  if v_exists then
    delete from public.listing_favorites
     where user_id = auth.uid() and listing_id = p_listing;
    return false;
  end if;

  insert into public.listing_favorites (user_id, listing_id)
  values (auth.uid(), p_listing)
  on conflict (user_id, listing_id) do nothing;
  return true;
end; $$;
grant execute on function public.toggle_listing_favorite(uuid) to authenticated;

-- Önbelleği yenile
notify pgrst, 'reload schema';

-- Kontrol: hepsi "var" görünmeli
select 'fonksiyon: ' || proname as kontrol, 'var' as durum
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('admin_delete_review','admin_clear_reviews','admin_set_sales_count',
                  'admin_sync_sales_count','send_message','admin_clear_conversation',
                  'after_review_delete','admin_delete_account',
                  'increment_listing_view','toggle_listing_favorite')
order by 1;

select 'kolon: listings.view_count/favorite_count' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'listings' and column_name = 'favorite_count') as durum;

select 'tablo: listing_favorites' as kontrol,
       (select 'var' from information_schema.tables
         where table_schema = 'public' and table_name = 'listing_favorites') as durum;

select 'kolon: reports.admin_note' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'reports' and column_name = 'admin_note') as durum;
