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
    new.flag_reason := array_to_string(v_flags, ', ');
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
                  'admin_set_review_status')
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

select 'kolon: reports.admin_note' as kontrol,
       (select 'var' from information_schema.columns
         where table_schema = 'public' and table_name = 'reports' and column_name = 'admin_note') as durum;
