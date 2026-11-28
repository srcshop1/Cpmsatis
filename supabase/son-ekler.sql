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
drop function if exists public.admin_delete_account(uuid);

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

-- ---------- 5s) FİYAT GEÇMİŞİ / ROZET / NOTLAR / YANIT SÜRESİ ----------
-- Fiyat düşünce eski fiyat saklanır (ilan altında "fiyat düştü" etiketi)
alter table public.listings add column if not exists previous_price numeric;
alter table public.listings add column if not exists price_dropped_at timestamptz;

create or replace function public.track_listing_price()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.price is distinct from old.price and new.price < coalesce(old.price, 0) then
    new.previous_price := old.price;
    new.price_dropped_at := now();
  end if;
  return new;
end; $$;

drop trigger if exists listings_track_price on public.listings;
create trigger listings_track_price before update of price on public.listings
for each row execute function public.track_listing_price();

-- Yetkili notları (panelde kullanıcı hakkında)
create table if not exists public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists user_notes_user_idx on public.user_notes (user_id, created_at desc);
alter table public.user_notes enable row level security;

drop policy if exists user_notes_read on public.user_notes;
create policy user_notes_read on public.user_notes for select using (public.is_staff());

drop policy if exists user_notes_write on public.user_notes;
create policy user_notes_write on public.user_notes for insert with check (public.is_staff());

drop policy if exists user_notes_delete on public.user_notes;
create policy user_notes_delete on public.user_notes for delete using (public.is_staff());

-- Bildiri önceliği
alter table public.reports add column if not exists priority text not null default 'normal';
update public.reports set priority = 'normal' where priority is null;

-- Satıcının ortalama yanıt süresi (dakika)
create or replace function public.seller_response_minutes(p_user uuid)
returns integer language sql security definer set search_path = public as $$
  with m as (
    select conversation_id, sender_id, created_at,
           lag(sender_id) over (partition by conversation_id order by created_at) as prev_sender,
           lag(created_at) over (partition by conversation_id order by created_at) as prev_at
    from public.messages
    where created_at > now() - interval '120 days'
  ), r as (
    select extract(epoch from (created_at - prev_at)) / 60.0 as mins
    from m
    where sender_id = p_user
      and prev_sender is not null
      and prev_sender <> p_user
      and extract(epoch from (created_at - prev_at)) between 0 and 259200
  )
  select case when count(*) = 0 then null else round(avg(mins))::int end from r;
$$;
grant execute on function public.seller_response_minutes(uuid) to anon, authenticated;

-- ---------- 5t) İNDİRİMLİ FİYAT (aylık hak) ----------
-- Fiyat geçmişi otomatik takibi kapatıldı; indirim artık elle ve kontenjanlı.
drop trigger if exists listings_track_price on public.listings;
drop function if exists public.track_listing_price();

create table if not exists public.listing_discounts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  old_price numeric not null,
  new_price numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists listing_discounts_seller_idx
  on public.listing_discounts (seller_id, created_at desc);
create index if not exists listing_discounts_listing_idx
  on public.listing_discounts (listing_id);

alter table public.listing_discounts enable row level security;

drop policy if exists listing_discounts_read on public.listing_discounts;
create policy listing_discounts_read on public.listing_discounts
  for select using (seller_id = auth.uid() or public.is_staff());

-- Aylık indirim hakkı: herkes 2, premium 4, VIP 6, moderatör 6, kurucu sınırsız (-1)
create or replace function public.my_discount_limit()
returns integer language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if auth.uid() is null then return 0; end if;

  select role into v_role from public.user_roles where user_id = auth.uid();
  if v_role = 'owner' then return -1; end if;
  if v_role = 'moderator' then return 6; end if;

  if exists (select 1 from public.user_tags where user_id = auth.uid() and tag = 'vip') then
    return 6;
  end if;
  if exists (select 1 from public.user_tags where user_id = auth.uid() and tag = 'premium') then
    return 4;
  end if;
  return 2;
end; $$;
grant execute on function public.my_discount_limit() to authenticated;

-- Bu ay kaç indirim kullandım?
create or replace function public.my_discount_usage()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_used integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('limit', 0, 'used', 0, 'remaining', 0);
  end if;

  v_limit := public.my_discount_limit();
  select count(*) into v_used
    from public.listing_discounts
   where seller_id = auth.uid()
     and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'limit', v_limit,
    'used', v_used,
    'remaining', case when v_limit < 0 then null else greatest(0, v_limit - v_used) end
  );
end; $$;
grant execute on function public.my_discount_usage() to authenticated;

-- İndirimi uygula (hakkı düşer)
create or replace function public.apply_listing_discount(p_listing uuid, p_price numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row record;
  v_limit integer;
  v_used integer;
  v_old numeric;
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın'; end if;

  select id, seller_id, price, previous_price into v_row
    from public.listings where id = p_listing;
  if v_row is null then raise exception 'İlan bulunamadı'; end if;
  if v_row.seller_id <> auth.uid() then
    raise exception 'Sadece kendi ilanına indirim yapabilirsin';
  end if;
  if p_price is null or p_price < 0 then raise exception 'Geçersiz fiyat'; end if;

  v_old := coalesce(v_row.previous_price, v_row.price);
  if p_price >= v_old then
    raise exception 'İndirimli fiyat eski fiyattan düşük olmalı';
  end if;

  v_limit := public.my_discount_limit();
  select count(*) into v_used
    from public.listing_discounts
   where seller_id = auth.uid()
     and created_at >= date_trunc('month', now());

  if v_limit >= 0 and v_used >= v_limit then
    raise exception 'Bu ayki indirim hakkın doldu';
  end if;

  update public.listings
     set price = p_price,
         previous_price = v_old,
         price_dropped_at = now()
   where id = p_listing;

  insert into public.listing_discounts (listing_id, seller_id, old_price, new_price)
  values (p_listing, auth.uid(), v_old, p_price);

  return jsonb_build_object(
    'limit', v_limit,
    'used', v_used + 1,
    'remaining', case when v_limit < 0 then null else greatest(0, v_limit - v_used - 1) end
  );
end; $$;
grant execute on function public.apply_listing_discount(uuid, numeric) to authenticated;

-- İndirimi geri al (hak geri gelmez)
create or replace function public.cancel_listing_discount(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın'; end if;
  update public.listings
     set price = coalesce(previous_price, price),
         previous_price = null,
         price_dropped_at = null
   where id = p_listing and seller_id = auth.uid();
  if not found then raise exception 'İlan bulunamadı'; end if;
end; $$;
grant execute on function public.cancel_listing_discount(uuid) to authenticated;

-- Eski otomatik fiyat geçmişi kayıtlarını temizle (yanlış indirim görünmesin)
update public.listings set previous_price = null, price_dropped_at = null
 where price_dropped_at is not null
   and not exists (select 1 from public.listing_discounts d where d.listing_id = listings.id);

-- ---------- 5u) SAHTE DEĞERLENDİRME KORUMASI ----------
alter table public.reviews add column if not exists status text not null default 'approved';
alter table public.reviews add column if not exists flag_reason text;
update public.reviews set status = 'approved' where status is null;

-- Herkes yalnız onaylı değerlendirmeleri görür (şüpheliler yetkiliye görünür)
drop policy if exists "Değerlendirmeler herkese açık" on public.reviews;
create policy "Değerlendirmeler herkese açık" on public.reviews for select
  using (status = 'approved' or buyer_id = auth.uid() or seller_id = auth.uid() or public.is_staff());

-- Puanı yalnız onaylı değerlendirmelerden hesapla
create or replace function public.recalc_seller_rating(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p set
    rating = (select round(avg(r.overall)::numeric, 2) from public.reviews r
               where r.seller_id = p_user and r.status = 'approved'),
    review_count = (select count(*) from public.reviews r
                     where r.seller_id = p_user and r.status = 'approved')
  where p.id = p_user;
end; $$;
grant execute on function public.recalc_seller_rating(uuid) to authenticated;

-- Değerlendirme yazılırken kontrol: onaylı satış, hesap yaşı, sıklık
create or replace function public.guard_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_age interval;
  v_pair integer;
  v_day integer;
  v_flags text[] := '{}';
begin
  if new.sale_id is null then
    raise exception 'Değerlendirme için onaylanmış satış gerekir';
  end if;

  if not exists (
    select 1 from public.sales s
     where s.id = new.sale_id
       and s.seller_id = new.seller_id
       and s.buyer_id = new.buyer_id
       and s.status = 'approved'
  ) then
    raise exception 'Sadece onaylanmış satıştan sonra değerlendirme yapılabilir';
  end if;

  select now() - created_at into v_age from public.profiles where id = new.buyer_id;
  if v_age is null then raise exception 'Alıcı bulunamadı'; end if;
  if v_age < interval '2 days' then
    raise exception 'Hesabın 2 günlük olduktan sonra değerlendirme yapabilirsin';
  end if;

  select count(*) into v_pair from public.reviews
   where buyer_id = new.buyer_id and seller_id = new.seller_id
     and created_at > now() - interval '30 days';
  if v_pair > 0 then
    raise exception 'Aynı satıcıyı 30 günde yalnızca bir kez değerlendirebilirsin';
  end if;

  select count(*) into v_day from public.reviews
   where buyer_id = new.buyer_id and created_at > now() - interval '1 day';
  if v_day >= 5 then
    raise exception 'Günde en fazla 5 değerlendirme yapabilirsin';
  end if;

  if v_age < interval '30 days' then
    v_flags := array_append(v_flags, 'yeni hesap');
  end if;
  if exists (
    select 1 from public.reviews r
     where r.buyer_id = new.seller_id and r.seller_id = new.buyer_id
       and r.created_at > now() - interval '30 days'
  ) then
    v_flags := array_append(v_flags, 'karşılıklı değerlendirme');
  end if;
  if (select count(*) from public.reviews r
       where r.buyer_id = new.buyer_id and r.created_at > now() - interval '30 days') >= 6 then
    v_flags := array_append(v_flags, 'çok sık değerlendirme');
  end if;
  if (select count(*) from public.sales s
       where s.seller_id = new.seller_id and s.buyer_id = new.buyer_id
         and s.status = 'approved') > 3 then
    v_flags := array_append(v_flags, 'aynı çift çok işlem');
  end if;

  if array_length(v_flags, 1) > 0 then
    new.status := 'pending';
    new.flag_reason := coalesce(nullif(new.flag_reason, '') || ', ', '')
                       || array_to_string(v_flags, ', ');
  end if;

  return new;
end; $$;

drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before insert on public.reviews
for each row execute function public.guard_review();

-- Ekleme / silme sonrası puanı yeniden hesapla
create or replace function public.after_review_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_seller_rating(new.seller_id);

  if new.status = 'approved' then
    perform public.notify(new.seller_id, 'review', 'Yeni değerlendirme',
      'Bir alıcı seni ' || new.overall || '/5 puanla değerlendirdi.', '/profil');
  end if;
  return new;
end; $$;

create or replace function public.after_review_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_seller_rating(old.seller_id);
  return old;
end; $$;

-- Yetkili: şüpheli değerlendirmeyi onayla / şüpheliye al
create or replace function public.admin_set_review_status(p_review uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_seller uuid;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_status not in ('approved', 'pending') then raise exception 'Geçersiz durum'; end if;

  update public.reviews
     set status = p_status,
         flag_reason = case when p_status = 'approved' then null else flag_reason end
   where id = p_review
  returning seller_id into v_seller;

  if v_seller is null then raise exception 'Değerlendirme bulunamadı'; end if;
  perform public.recalc_seller_rating(v_seller);
end; $$;
grant execute on function public.admin_set_review_status(uuid, text) to authenticated;

-- Yetkili kaldırma işlemleri de onaylı puanla çalışsın
create or replace function public.admin_delete_review(p_review uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_seller uuid; v_by text;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;

  select seller_id into v_seller from public.reviews where id = p_review;
  if v_seller is null then raise exception 'Değerlendirme bulunamadı'; end if;

  delete from public.reviews where id = p_review;
  perform public.recalc_seller_rating(v_seller);

  select username into v_by from public.profiles where id = auth.uid();
  perform public.notify(v_seller, 'review', 'Değerlendirme kaldırıldı',
    coalesce(v_by, 'Yetkili') || ' bir değerlendirmeni kaldırdı.', '/profil');
end; $$;

create or replace function public.admin_clear_reviews(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'Yetkisiz'; end if;

  delete from public.reviews where seller_id = p_user;
  get diagnostics v_count = row_count;
  perform public.recalc_seller_rating(p_user);

  if v_count > 0 then
    perform public.notify(p_user, 'review', 'Değerlendirmeler kaldırıldı',
      'Profilindeki değerlendirmeler yetkili tarafından kaldırıldı.', '/profil');
  end if;
  return v_count;
end; $$;

-- ---------- 5v) SAHTE BAŞARILI İŞLEM KORUMASI ----------
alter table public.sales add column if not exists counted boolean not null default true;
alter table public.sales add column if not exists flag_reason text;
update public.sales set counted = true where counted is null;

-- Başarılı işlem sayısı = onaylı ve sayılan satışlar
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

-- Satışı bitir: şüpheliyse "sayılmayan" olarak kapat
create or replace function public.settle_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_age interval;
  v_pair integer;
  v_day integer;
  v_flags text[] := '{}';
  v_title text;
begin
  select * into v_sale from public.sales where id = p_sale;
  if v_sale is null then raise exception 'Satış bulunamadı'; end if;
  if v_sale.status = 'approved' then return; end if;

  select now() - created_at into v_age from public.profiles where id = v_sale.buyer_id;

  select count(*) into v_pair from public.sales
   where seller_id = v_sale.seller_id and buyer_id = v_sale.buyer_id
     and status = 'approved' and counted
     and created_at > now() - interval '30 days';

  select count(*) into v_day from public.sales
   where seller_id = v_sale.seller_id and status = 'approved' and counted
     and coalesce(approved_at, created_at) > now() - interval '1 day';

  if v_age is not null and v_age < interval '7 days' then
    v_flags := array_append(v_flags, 'alıcı hesabı yeni');
  end if;
  if v_pair >= 2 then
    v_flags := array_append(v_flags, 'aynı çift çok işlem');
  end if;
  if v_day >= 8 then
    v_flags := array_append(v_flags, 'günlük satış sınırı');
  end if;

  select title into v_title from public.listings where id = v_sale.listing_id;

  update public.sales
     set status = 'approved',
         approved_at = now(),
         counted = (coalesce(array_length(v_flags, 1), 0) = 0),
         flag_reason = case when coalesce(array_length(v_flags, 1), 0) = 0 then null
                            else array_to_string(v_flags, ', ') end
   where id = p_sale;

  perform public.recalc_sales_count(v_sale.seller_id);

  perform public.notify(v_sale.seller_id, 'sale', 'Satış tamamlandı',
    v_title || case when coalesce(array_length(v_flags, 1), 0) = 0
                    then ' satışı onaylandı. Başarılı işlem sayın arttı.'
                    else ' satışı onaylandı fakat incelemeye alındı.' end,
    '/profil');
  perform public.notify(v_sale.buyer_id, 'review', 'Siparişi değerlendir',
    v_title || ' için satıcıyı değerlendir.', '/siparisler');
end; $$;
grant execute on function public.settle_sale(uuid) to authenticated;

create or replace function public.approve_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_sale public.sales;
begin
  select * into v_sale from public.sales where id = p_sale;
  if v_sale is null or (v_sale.buyer_id <> auth.uid() and not public.is_staff()) then
    raise exception 'Yetkisiz';
  end if;
  perform public.settle_sale(p_sale);
end; $$;
grant execute on function public.approve_sale(uuid) to authenticated;

create or replace function public.resolve_sales()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_count integer := 0;
begin
  for r in select id from public.sales
            where status in ('pending_buyer','confirmed')
              and auto_approve_at < now()
  loop
    perform public.settle_sale(r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
grant execute on function public.resolve_sales() to authenticated;

create or replace function public.admin_sync_sales_count(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'Yetkisiz'; end if;
  return public.recalc_sales_count(p_user);
end; $$;
grant execute on function public.admin_sync_sales_count(uuid) to authenticated;

-- Sayılmayan (şüpheli) satıştan gelen değerlendirme de incelemeye düşsün
create or replace function public.flag_review_from_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sale_id is not null and exists (
    select 1 from public.sales s where s.id = new.sale_id and not s.counted
  ) then
    new.status := 'pending';
    new.flag_reason := coalesce(nullif(new.flag_reason, '') || ', ', '') || 'şüpheli işlem';
  end if;
  return new;
end; $$;

drop trigger if exists reviews_flag_sale on public.reviews;
create trigger reviews_flag_sale before insert on public.reviews
for each row execute function public.flag_review_from_sale();

-- Yetkili: işlemi say / saymayı kaldır
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

-- ---------- 5w) HESAP SİLME (doğrulamalı) + EKSİK GİRİŞ TEMİZLİĞİ ----------
create table if not exists public.account_cleanup (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.account_cleanup enable row level security;
drop policy if exists account_cleanup_read on public.account_cleanup;
create policy account_cleanup_read on public.account_cleanup for select using (public.is_staff());

-- Hesabı sil: profil + tüm veriler, ardından giriş hesabı.
-- Dönen değer: 'tam' (hepsi silindi) veya 'profil' (giriş kaydı kaldı)
drop function if exists public.admin_delete_account(uuid);

create or replace function public.admin_delete_account(p_user uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare v_role text;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_user = auth.uid() then raise exception 'Kendi hesabını silemezsin'; end if;

  select role into v_role from public.user_roles where user_id = p_user;
  if v_role = 'owner' then raise exception 'Kurucu hesabı silinemez'; end if;
  if v_role = 'moderator' and public.my_staff_role() <> 'owner' then
    raise exception 'Yetkili hesabını sadece kurucu silebilir';
  end if;

  -- Giriş hesabı önce silinirse profil cascade ile gider; olmazsa profili elle sil
  begin
    delete from auth.users where id = p_user;
  exception when others then
    null;
  end;

  delete from public.profiles where id = p_user;

  if exists (select 1 from auth.users where id = p_user) then
    insert into public.account_cleanup (user_id) values (p_user)
    on conflict (user_id) do nothing;
  else
    delete from public.account_cleanup where user_id = p_user;
  end if;

  if exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Hesap silinemedi';
  end if;

  return case when exists (select 1 from auth.users where id = p_user) then 'profil' else 'tam' end;
end; $$;
grant execute on function public.admin_delete_account(uuid) to authenticated;

-- Profili olmayan (silinmiş ama giriş kaydı kalmış) hesapları temizle
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
  delete from public.account_cleanup c
   where not exists (select 1 from auth.users u where u.id = c.user_id);

  return v_count;
end; $$;
grant execute on function public.admin_purge_orphan_accounts() to authenticated;

-- ---------- 5y) KULLANICI KENDİ HESABINI SİLER ----------
-- Şifre kontrolü uygulama tarafında yapılır; burada gerçek silme ve doğrulama var
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Giriş yapmalısın'; end if;
  if exists (select 1 from public.user_roles where user_id = v_uid and role = 'owner') then
    raise exception 'Kurucu hesabı silinemez';
  end if;

  begin
    delete from auth.users where id = v_uid;
  exception when others then
    null;
  end;

  delete from public.profiles where id = v_uid;

  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Hesap silinemedi';
  end if;

  if exists (select 1 from auth.users u where u.id = v_uid) then
    insert into public.account_cleanup (user_id) values (v_uid)
    on conflict (user_id) do nothing;
  end if;
end; $$;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- 5z) İLAN SÜRESİ: YENİLE + OTOMATİK SİLME ----------
-- 15 günü dolan ilan gizlenir (expired_at damgalanır).
-- Sahibi 2 gün içinde "Yenile" derse 15 gün daha yayında kalır.
-- Yenilenmeyen ve satışı olmayan ilanlar 2 gün sonunda silinir.
alter table public.listings add column if not exists expired_at timestamptz;

update public.listings
   set expired_at = now() - interval '16 days'
 where status = 'hidden' and expired_at is null and created_at < now() - interval '15 days';

create or replace function public.expire_listings()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.listings
     set status = 'hidden',
         expired_at = coalesce(expired_at, now())
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
  if public.ban_active(auth.uid()) then
    raise exception 'Hesabınız askıda olduğu için ilan yenilenemez';
  end if;

  update public.listings
     set created_at = now(),
         status = 'active',
         expired_at = null
   where id = p_listing;
end; $$;
grant execute on function public.renew_listing(uuid) to authenticated;

create or replace function public.purge_expired_listings()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  delete from public.listings l
   where l.expired_at is not null
     and l.expired_at < now() - interval '2 days'
     and not exists (select 1 from public.sales s where s.listing_id = l.id);
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.purge_expired_listings() to authenticated;

-- ---------- 5aa) GÖRÜNTÜLENME + YENİLEME SINIRI + ÖNE ÇIKARMA LİMİTİ ----------
-- Bir kişi bir ilana ömrü boyunca 1 görüntülenme verir.
create table if not exists public.listing_views (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
alter table public.listing_views enable row level security;

create or replace function public.register_listing_view(p_listing uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_count integer;
  v_new boolean := false;
begin
  select seller_id, coalesce(view_count, 0) into v_owner, v_count
    from public.listings where id = p_listing;
  if v_owner is null then return 0; end if;

  -- Kendi ilanına bakan sayılmaz
  if v_uid is not null and v_uid = v_owner then
    return v_count;
  end if;

  if v_uid is null then
    update public.listings set view_count = coalesce(view_count, 0) + 1
     where id = p_listing
    returning view_count into v_count;
    return coalesce(v_count, 0);
  end if;

  insert into public.listing_views (listing_id, user_id)
  values (p_listing, v_uid)
  on conflict (listing_id, user_id) do nothing;
  v_new := found;

  if v_new then
    update public.listings set view_count = coalesce(view_count, 0) + 1
     where id = p_listing
    returning view_count into v_count;
  end if;

  return coalesce(v_count, 0);
end; $$;
grant execute on function public.register_listing_view(uuid) to anon, authenticated;

-- Yenileme: yalnızca son 1 gün kaldığında veya süresi dolduğunda
create or replace function public.renew_listing(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_created timestamptz;
begin
  select created_at into v_created
    from public.listings where id = p_listing and seller_id = auth.uid();

  if v_created is null then
    raise exception 'Bu ilanın sahibi değilsin';
  end if;
  if public.ban_active(auth.uid()) then
    raise exception 'Hesabın askıda olduğu için ilan yenilenemez';
  end if;
  if v_created > now() - interval '14 days' then
    raise exception 'İlanın süresi dolmadan yenileyemezsin. Son 1 gün kaldığında yenileyebilirsin.';
  end if;

  update public.listings
     set created_at = now(),
         status = 'active',
         expired_at = null,
         featured_requested = false
   where id = p_listing;
end; $$;
grant execute on function public.renew_listing(uuid) to authenticated;

-- Öne çıkarma talebi: ilan başına sınır + talepler arası bekleme
create or replace function public.request_featured(p_listing uuid, p_days integer default 7)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_role text;
  v_tier text;
  v_max integer := 2;
  v_cooldown interval := interval '24 hours';
  v_used integer;
  v_pending boolean;
  v_last timestamptz;
  v_left interval;
begin
  if v_uid is null then raise exception 'Giriş yapmalısın'; end if;

  select seller_id into v_owner from public.listings where id = p_listing;
  if v_owner is null then raise exception 'İlan bulunamadı'; end if;
  if v_owner <> v_uid then raise exception 'Bu ilanın sahibi değilsin'; end if;
  if public.ban_active(v_uid) then raise exception 'Hesabın askıda olduğu için talep gönderemezsin'; end if;

  v_role := public.my_staff_role();

  select case
    when exists (select 1 from public.user_tags where user_id = v_uid and tag = 'vip') then 'vip'
    when exists (select 1 from public.user_tags where user_id = v_uid and tag = 'premium') then 'premium'
    else 'normal'
  end into v_tier;

  if v_role is not null then
    v_max := 10;
    v_cooldown := interval '0 hours';
  elsif v_tier = 'vip' then
    v_max := 3;
    v_cooldown := interval '18 hours';
  elsif v_tier = 'premium' then
    v_max := 2;
    v_cooldown := interval '20 hours';
  end if;

  select exists (
    select 1 from public.featured_requests
     where listing_id = p_listing and status = 'pending'
  ) into v_pending;
  if v_pending then
    raise exception 'Bu ilan için onay bekleyen bir talebin var';
  end if;

  select count(*) into v_used
    from public.featured_requests where listing_id = p_listing;
  if v_used >= v_max then
    raise exception 'Bu ilan için en fazla % kez öne çıkarma talebi gönderebilirsin', v_max;
  end if;

  select max(created_at) into v_last
    from public.featured_requests where seller_id = v_uid;
  if v_last is not null and now() - v_last < v_cooldown then
    v_left := v_cooldown - (now() - v_last);
    raise exception 'Yeni talep için beklemen gerekiyor. Kalan süre: % saat',
      greatest(1, ceil(extract(epoch from v_left) / 3600)::integer);
  end if;

  insert into public.featured_requests (listing_id, seller_id, days)
  values (p_listing, v_uid, p_days);
end; $$;
grant execute on function public.request_featured(uuid, integer) to authenticated;

-- ---------- 5ab) ÇERÇEVE SEÇİMİ (sunucu doğrulamalı) ----------
-- Başarı çerçeveleri yalnızca hak edildiğinde takılabilir.
create or replace function public.frame_unlocked(p_frame text, p_user uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_rating numeric := 0;
  v_reviews integer := 0;
  v_sales integer := 0;
  v_minutes integer;
  v_days integer := 0;
  v_listings integer := 0;
  v_views integer := 0;
  v_favs integer := 0;
begin
  if v_user is null then return false; end if;

  if exists (select 1 from public.user_frames where user_id = v_user and frame = p_frame) then
    return true;
  end if;

  if p_frame = 'member' then return true; end if;

  if p_frame = 'verified_seller' then
    return exists (select 1 from public.profiles where id = v_user and verified_seller)
        or exists (select 1 from public.user_tags where user_id = v_user and tag = 'verified_seller');
  end if;

  if p_frame in ('vip', 'premium') then
    return exists (select 1 from public.user_tags where user_id = v_user and tag = p_frame);
  end if;

  if p_frame in ('moderator', 'owner') then
    return exists (select 1 from public.user_roles where user_id = v_user and role = p_frame);
  end if;

  select coalesce(rating, 0), coalesce(review_count, 0), coalesce(sales_count, 0),
         greatest(0, extract(day from now() - created_at)::integer)
    into v_rating, v_reviews, v_sales, v_days
    from public.profiles where id = v_user;

  select count(*) filter (where status = 'active'),
         coalesce(sum(view_count), 0),
         coalesce(sum(favorite_count), 0)
    into v_listings, v_views, v_favs
    from public.listings where seller_id = v_user;

  v_minutes := public.seller_response_minutes(v_user);

  return case p_frame
    when 'ach_first_sale' then v_sales >= 1
    when 'ach_member_1y' then v_days >= 365
    when 'ach_sales_10' then v_sales >= 10
    when 'ach_reviews_10' then v_reviews >= 10
    when 'ach_listings_10' then v_listings >= 10
    when 'ach_fast_20' then coalesce(v_minutes, 99999) > 0 and coalesce(v_minutes, 99999) <= 20
    when 'ach_sales_25' then v_sales >= 25
    when 'ach_reviews_30_45' then v_reviews >= 30 and v_rating >= 4.5
    when 'ach_sales_50' then v_sales >= 50
    when 'ach_views_1000' then v_views >= 1000
    when 'ach_fast_5' then coalesce(v_minutes, 99999) > 0 and coalesce(v_minutes, 99999) <= 5
    when 'ach_favorites_100' then v_favs >= 100
    when 'ach_rating_50' then v_reviews >= 20 and v_rating >= 4.95
    when 'ach_sales_100' then v_sales >= 100
    when 'ach_reviews_100' then v_reviews >= 100
    else false
  end;
end; $$;
grant execute on function public.frame_unlocked(text, uuid) to anon, authenticated;

create or replace function public.set_frame(p_frame text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın'; end if;
  if not public.frame_unlocked(p_frame) then
    raise exception 'Bu çerçeve henüz açılmadı';
  end if;
  update public.profiles set equipped_frame = p_frame where id = auth.uid();
end; $$;
grant execute on function public.set_frame(text) to authenticated;

-- ---------- 5ac) ÇERÇEVE KURALLARI (güncel) ----------
create or replace function public.frame_unlocked(p_frame text, p_user uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_rating numeric := 0;
  v_reviews integer := 0;
  v_sales integer := 0;
  v_minutes integer;
  v_days integer := 0;
  v_listings integer := 0;
  v_views integer := 0;
  v_favs integer := 0;
begin
  if v_user is null then return false; end if;

  if exists (select 1 from public.user_frames where user_id = v_user and frame = p_frame) then
    return true;
  end if;

  if p_frame = 'member' then return true; end if;

  if p_frame = 'verified_seller' then
    return exists (select 1 from public.profiles where id = v_user and verified_seller)
        or exists (select 1 from public.user_tags where user_id = v_user and tag = 'verified_seller');
  end if;

  if p_frame in ('vip', 'premium') then
    return exists (select 1 from public.user_tags where user_id = v_user and tag = p_frame);
  end if;

  if p_frame in ('moderator', 'owner') then
    return exists (select 1 from public.user_roles where user_id = v_user and role = p_frame);
  end if;

  select coalesce(rating, 0), coalesce(review_count, 0), coalesce(sales_count, 0),
         greatest(0, extract(day from now() - created_at)::integer)
    into v_rating, v_reviews, v_sales, v_days
    from public.profiles where id = v_user;

  select count(*) filter (where status = 'active'),
         coalesce(sum(view_count), 0),
         coalesce(sum(favorite_count), 0)
    into v_listings, v_views, v_favs
    from public.listings where seller_id = v_user;

  v_minutes := public.seller_response_minutes(v_user);

  return case p_frame
    when 'ach_first_sale' then v_sales >= 1
    when 'ach_member_1y' then v_days >= 365
    when 'ach_sales_10' then v_sales >= 10
    when 'ach_rating_40' then v_reviews >= 10 and v_rating >= 4.0
    when 'ach_listings_10' then v_listings >= 10
    when 'ach_fast_20' then coalesce(v_minutes, 99999) > 0 and coalesce(v_minutes, 99999) <= 20
    when 'ach_sales_25' then v_sales >= 25
    when 'ach_rating_45' then v_reviews >= 30 and v_rating >= 4.5
    when 'ach_sales_50' then v_sales >= 50
    when 'ach_views_1000' then v_views >= 1000
    when 'ach_fast_5' then coalesce(v_minutes, 99999) > 0 and coalesce(v_minutes, 99999) <= 5
    when 'ach_favorites_100' then v_favs >= 100
    when 'ach_rating_48' then v_reviews >= 60 and v_rating >= 4.8
    when 'ach_rating_50' then v_reviews >= 20 and v_rating >= 4.95
    when 'ach_sales_100' then v_sales >= 100
    when 'ach_rating_100' then v_reviews >= 100 and v_rating >= 4.5
    else false
  end;
end; $$;
grant execute on function public.frame_unlocked(text, uuid) to anon, authenticated;

-- Çerçeve verme/alma yalnızca kurucuda
create or replace function public.admin_set_frame(
  p_user uuid,
  p_frame text,
  p_remove boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_staff_role() is distinct from 'owner' then
    raise exception 'Çerçeve verme/alma yalnızca kurucuya açık';
  end if;

  if p_frame not in (
    'member','verified_seller','vip','premium','moderator','owner',
    'ach_first_sale','ach_member_1y','ach_sales_10','ach_rating_40','ach_listings_10',
    'ach_fast_20','ach_sales_25','ach_rating_45','ach_sales_50','ach_views_1000',
    'ach_fast_5','ach_favorites_100','ach_rating_48','ach_rating_50','ach_sales_100',
    'ach_rating_100'
  ) then
    raise exception 'Geçersiz çerçeve';
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






-- Satış sayılırken ek sinyal: son 30 günde yeni hesaplardan gelen işlemler
create or replace function public.settle_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_age interval;
  v_pair integer;
  v_day integer;
  v_fresh integer;
  v_flags text[] := '{}';
  v_title text;
begin
  select * into v_sale from public.sales where id = p_sale;
  if v_sale is null then raise exception 'Satış bulunamadı'; end if;
  if v_sale.status = 'approved' then return; end if;

  select now() - created_at into v_age from public.profiles where id = v_sale.buyer_id;

  select count(*) into v_pair from public.sales
   where seller_id = v_sale.seller_id and buyer_id = v_sale.buyer_id
     and status = 'approved' and counted
     and created_at > now() - interval '30 days';

  select count(*) into v_day from public.sales
   where seller_id = v_sale.seller_id and status = 'approved' and counted
     and coalesce(approved_at, created_at) > now() - interval '1 day';

  -- Alıcı hesabı satış anında 30 günden genç olan sayılan işlemler
  select count(*) into v_fresh
    from public.sales s
    join public.profiles p on p.id = s.buyer_id
   where s.seller_id = v_sale.seller_id
     and s.status = 'approved' and s.counted
     and s.created_at > now() - interval '30 days'
     and p.created_at > s.created_at - interval '30 days';

  if v_age is not null and v_age < interval '7 days' then
    v_flags := array_append(v_flags, 'alıcı hesabı yeni');
  end if;
  if v_pair >= 2 then
    v_flags := array_append(v_flags, 'aynı çift çok işlem');
  end if;
  if v_day >= 8 then
    v_flags := array_append(v_flags, 'günlük satış sınırı');
  end if;
  if v_fresh >= 3 then
    v_flags := array_append(v_flags, 'yeni hesaplardan işlem');
  end if;

  select title into v_title from public.listings where id = v_sale.listing_id;

  update public.sales
     set status = 'approved',
         approved_at = now(),
         counted = (coalesce(array_length(v_flags, 1), 0) = 0),
         flag_reason = case when coalesce(array_length(v_flags, 1), 0) = 0 then null
                            else array_to_string(v_flags, ', ') end
   where id = p_sale;

  perform public.recalc_sales_count(v_sale.seller_id);

  perform public.notify(v_sale.seller_id, 'sale', 'Satış tamamlandı',
    v_title || case when coalesce(array_length(v_flags, 1), 0) = 0
                    then ' satışı onaylandı. Başarılı işlem sayın arttı.'
                    else ' satışı onaylandı fakat incelemeye alındı.' end,
    '/profil');
  perform public.notify(v_sale.buyer_id, 'review', 'Siparişi değerlendir',
    v_title || ' için satıcıyı değerlendir.', '/siparisler');
end; $$;
grant execute on function public.settle_sale(uuid) to authenticated;

-- ---------- 5x) ASKIYA ALMA (SÜRELİ / KALICI) + ARD ARDA YENİ HESAP KURALI ----------
alter table public.profiles add column if not exists banned_until timestamptz;
alter table public.profiles add column if not exists ban_reason text;
update public.profiles set banned_until = null where banned is false;

-- Askı gerçekten etkin mi? (süresi dolmuşsa etkin değil)
create or replace function public.ban_active(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.banned and (p.banned_until is null or p.banned_until > now())
      from public.profiles p where p.id = p_user
  ), false);
$$;
grant execute on function public.ban_active(uuid) to anon, authenticated;

-- Süresi dolan askıları temizle
create or replace function public.expire_bans()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  update public.profiles
     set banned = false, banned_until = null, ban_reason = null
   where banned and banned_until is not null and banned_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.expire_bans() to authenticated;

-- Askıya al: p_days null/0 ise kalıcı, değilse günlük
drop function if exists public.admin_set_banned(uuid, boolean);

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

  if p_banned then
    update public.profiles
       set banned = true,
           banned_until = case
             when p_days is null or p_days <= 0 then null
             else now() + make_interval(days => least(greatest(p_days, 1), 3650))
           end,
           ban_reason = p_reason
     where id = p_user;

    update public.listings set status = 'hidden'
     where seller_id = p_user and status = 'active';
  else
    update public.profiles
       set banned = false, banned_until = null, ban_reason = null
     where id = p_user;
  end if;
end; $$;
grant execute on function public.admin_set_banned(uuid, boolean, integer, text) to authenticated;

-- Askıdaki kullanıcı ilan açamaz (süreli askı bitince otomatik açılır)
create or replace function public.block_banned_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.ban_active(new.seller_id) then
    raise exception 'Hesabınız askıya alındığı için ilan oluşturamazsınız';
  end if;
  return new;
end; $$;

-- --- Değerlendirme kontrolü: ard arda yeni hesaplardan gelen 3 puan incelemeye düşer ---
create or replace function public.guard_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_age interval;
  v_pair integer;
  v_day integer;
  v_counted boolean;
  v_young_streak integer := 0;
  v_flags text[] := '{}';
begin
  if new.sale_id is null then
    raise exception 'Değerlendirme için onaylanmış satış gerekir';
  end if;

  select s.counted into v_counted
    from public.sales s
   where s.id = new.sale_id
     and s.seller_id = new.seller_id
     and s.buyer_id = new.buyer_id
     and s.status = 'approved';

  if not found then
    raise exception 'Sadece onaylanmış satıştan sonra değerlendirme yapılabilir';
  end if;
  if v_counted is false then
    v_flags := array_append(v_flags, 'şüpheli işlem');
  end if;

  select now() - created_at into v_age from public.profiles where id = new.buyer_id;
  if v_age is null then raise exception 'Alıcı bulunamadı'; end if;
  if v_age < interval '2 days' then
    raise exception 'Hesabın 2 günlük olduktan sonra değerlendirme yapabilirsin';
  end if;

  select count(*) into v_pair from public.reviews
   where buyer_id = new.buyer_id and seller_id = new.seller_id
     and created_at > now() - interval '30 days';
  if v_pair > 0 then
    raise exception 'Aynı satıcıyı 30 günde yalnızca bir kez değerlendirebilirsin';
  end if;

  select count(*) into v_day from public.reviews
   where buyer_id = new.buyer_id and created_at > now() - interval '1 day';
  if v_day >= 5 then
    raise exception 'Günde en fazla 5 değerlendirme yapabilirsin';
  end if;

  -- Satıcının son 3 onaylı puanı da 30 günden genç hesaplardan mı?
  select count(*) into v_young_streak from (
    select (p.created_at > r.created_at - interval '30 days') as young
      from public.reviews r
      join public.profiles p on p.id = r.buyer_id
     where r.seller_id = new.seller_id and r.status = 'approved'
     order by r.created_at desc
     limit 3
  ) t where t.young;

  if v_age < interval '30 days' then
    v_flags := array_append(v_flags, 'yeni hesap');
  end if;
  if exists (
    select 1 from public.reviews r
     where r.buyer_id = new.seller_id and r.seller_id = new.buyer_id
       and r.created_at > now() - interval '30 days'
  ) then
    v_flags := array_append(v_flags, 'karşılıklı değerlendirme');
  end if;
  if (select count(*) from public.reviews r
       where r.buyer_id = new.buyer_id and r.created_at > now() - interval '30 days') >= 6 then
    v_flags := array_append(v_flags, 'çok sık değerlendirme');
  end if;
  if v_young_streak >= 3 then
    v_flags := array_append(v_flags, 'ard arda yeni hesaplardan puan');
  end if;

  if array_length(v_flags, 1) > 0 then
    new.status := 'pending';
    new.flag_reason := array_to_string(v_flags, ', ');
  end if;

  return new;
end; $$;

-- --- Satış kontrolü: ard arda 3 yeni hesap işlemi incelemeye düşer ---
create or replace function public.settle_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_age interval;
  v_pair integer;
  v_day integer;
  v_young_streak integer := 0;
  v_flags text[] := '{}';
  v_title text;
begin
  select * into v_sale from public.sales where id = p_sale;
  if v_sale is null then raise exception 'Satış bulunamadı'; end if;
  if v_sale.status = 'approved' then return; end if;

  select now() - created_at into v_age from public.profiles where id = v_sale.buyer_id;

  select count(*) into v_pair from public.sales
   where seller_id = v_sale.seller_id and buyer_id = v_sale.buyer_id
     and status = 'approved' and counted
     and created_at > now() - interval '30 days';

  select count(*) into v_day from public.sales
   where seller_id = v_sale.seller_id and status = 'approved' and counted
     and coalesce(approved_at, created_at) > now() - interval '1 day';

  -- Satıcının son 3 sayılan işlemi de 30 günden genç hesaplardan mı?
  select count(*) into v_young_streak from (
    select (p.created_at > s.created_at - interval '30 days') as young
      from public.sales s
      join public.profiles p on p.id = s.buyer_id
     where s.seller_id = v_sale.seller_id and s.status = 'approved' and s.counted
     order by s.created_at desc
     limit 3
  ) t where t.young;

  if v_age is not null and v_age < interval '7 days' then
    v_flags := array_append(v_flags, 'alıcı hesabı yeni');
  end if;
  if v_pair >= 2 then
    v_flags := array_append(v_flags, 'aynı çift çok işlem');
  end if;
  if v_day >= 8 then
    v_flags := array_append(v_flags, 'günlük satış sınırı');
  end if;
  if v_young_streak >= 3 then
    v_flags := array_append(v_flags, 'ard arda yeni hesap işlemi');
  end if;

  select title into v_title from public.listings where id = v_sale.listing_id;

  update public.sales
     set status = 'approved',
         approved_at = now(),
         counted = (coalesce(array_length(v_flags, 1), 0) = 0),
         flag_reason = case when coalesce(array_length(v_flags, 1), 0) = 0 then null
                            else array_to_string(v_flags, ', ') end
   where id = p_sale;

  perform public.recalc_sales_count(v_sale.seller_id);

  perform public.notify(v_sale.seller_id, 'sale', 'Satış tamamlandı',
    v_title || case when coalesce(array_length(v_flags, 1), 0) = 0
                    then ' satışı onaylandı. Başarılı işlem sayın arttı.'
                    else ' satışı onaylandı fakat incelemeye alındı.' end,
    '/profil');
  perform public.notify(v_sale.buyer_id, 'review', 'Siparişi değerlendir',
    v_title || ' için satıcıyı değerlendir.', '/siparisler');
end; $$;
grant execute on function public.settle_sale(uuid) to authenticated;

-- Önbelleği yenile
notify pgrst, 'reload schema';

-- Kontrol: hepsi "var" görünmeli
select 'fonksiyon: ' || proname as kontrol, 'var' as durum
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('admin_delete_review','admin_clear_reviews','admin_set_sales_count',
                  'admin_sync_sales_count','send_message','admin_clear_conversation',
                  'after_review_delete','admin_delete_account',
                  'increment_listing_view','toggle_listing_favorite',
                  'seller_response_minutes','my_discount_limit','my_discount_usage',
                  'apply_listing_discount','cancel_listing_discount','recalc_seller_rating',
                  'admin_set_review_status','settle_sale','recalc_sales_count',
                  'admin_set_sale_counted','admin_purge_orphan_accounts','ban_active','expire_bans')
order by 1;

select 'kolon: listings.view_count/favorite_count' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'listings' and column_name = 'favorite_count') as durum;

select 'tablo: listing_favorites' as kontrol,
       (select 'var' from information_schema.tables
         where table_schema = 'public' and table_name = 'listing_favorites') as durum;

select 'kolon: listings.previous_price' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'listings' and column_name = 'previous_price') as durum;

select 'tablo: user_notes' as kontrol,
       (select 'var' from information_schema.tables
         where table_schema = 'public' and table_name = 'user_notes') as durum;

select 'kolon: reports.priority' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'reports' and column_name = 'priority') as durum;

select 'tablo: listing_discounts' as kontrol,
       (select 'var' from information_schema.tables
         where table_schema = 'public' and table_name = 'listing_discounts') as durum;

select 'kolon: reviews.status' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'reviews' and column_name = 'status') as durum;

select 'kolon: sales.counted' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'sales' and column_name = 'counted') as durum;

select 'tablo: account_cleanup' as kontrol,
       (select 'var' from information_schema.tables
         where table_schema = 'public' and table_name = 'account_cleanup') as durum;

select 'kolon: profiles.banned_until' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles' and column_name = 'banned_until') as durum;

select 'kolon: reports.admin_note' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'reports' and column_name = 'admin_note') as durum;
