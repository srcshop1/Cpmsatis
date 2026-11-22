-- ============================================================
--  CPM SATIŞ · TEK DOSYADA TAM KURULUM / ONARIM
--  Supabase > SQL Editor > New query > TAMAMINI yapıştır > Run
--  Tekrar tekrar çalıştırılabilir. Veri silmez.
--  (schema-v3 + schema-v4 + onarımlar birleşik)
-- ============================================================

-- ============================================================
--  CPM Satış · TEK SEFERLİK TAM ŞEMA (v3)
--  Supabase > SQL Editor > New query > tamamını yapıştır > Run
--  Tekrar çalıştırılabilir. schema.sql / schema-v2.sql yerine geçer.
-- ============================================================

-- ---------- 1) PROFİLLER ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text,
  avatar_url text,
  rating numeric(3, 2) default 0,
  review_count integer not null default 0,
  sales_count integer default 0,
  last_seen_at TIMESTAMPTZ,
  bio text,
  verified_seller boolean not null default false,
  equipped_frame text,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists verified_seller boolean not null default false;
alter table public.profiles add column if not exists review_count integer not null default 0;
alter table public.profiles add column if not exists equipped_frame text;
alter table public.profiles add column if not exists banned boolean not null default false;

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, email)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username',''),
             nullif(new.raw_user_meta_data ->> 'display_name',''),
             split_part(new.email,'@',1)),
    new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- 2) KULLANICI ADIYLA GİRİŞ ----------
create or replace function public.email_for_username(uname text)
returns text language sql security definer stable set search_path = public, auth as $$
  select u.email::text
  from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(uname)) limit 1;
$$;
revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ---------- 3) ROLLER (gizli) ----------
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

-- ---------- 4) İLANLAR ----------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 72),
  description_html text,
  price numeric(12,2) not null check (price >= 0 and price <= 50000000),
  category text not null check (category in ('cpm1','cpm2','takas','satilik','cizim','krom')),
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('active','sold','hidden','removed')),
  featured_until timestamptz,
  featured_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_created_idx on public.listings (created_at desc);
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_buyer_idx on public.listings (seller_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at before update on public.listings
for each row execute function public.touch_updated_at();

alter table public.listings enable row level security;

drop policy if exists "Satılık ilanlar herkese açık" on public.listings;
create policy "Satılık ilanlar herkese açık" on public.listings for select
  using (status = 'active' or seller_id = auth.uid() or public.is_staff());

drop policy if exists "Kullanıcı kendi ilanını açar" on public.listings;
create policy "Kullanıcı kendi ilanını açar" on public.listings for insert to authenticated
  with check (seller_id = auth.uid());

drop policy if exists "Kullanıcı kendi ilanını günceller" on public.listings;
create policy "Kullanıcı kendi ilanını günceller" on public.listings for update to authenticated
  using (seller_id = auth.uid() or public.is_staff())
  with check (seller_id = auth.uid() or public.is_staff());

drop policy if exists "Kullanıcı kendi ilanını siler" on public.listings;
create policy "Kullanıcı kendi ilanını siler" on public.listings for delete to authenticated
  using (seller_id = auth.uid() or public.is_staff());

-- ---------- 5) PROFİL GÖRÜNÜRLÜĞÜ ----------
alter table public.profiles enable row level security;

drop policy if exists "Profiller herkese açık okunur" on public.profiles;
create policy "Profiller herkese açık okunur" on public.profiles for select using (true);

drop policy if exists "Kullanıcı kendi profilini günceller" on public.profiles;
create policy "Kullanıcı kendi profilini günceller" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- 6) DEPOLAMA ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images','listing-images',true,8388608,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars',true,4194304,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 4194304;

drop policy if exists "Görseller herkese açık" on storage.objects;
create policy "Görseller herkese açık" on storage.objects for select
  using (bucket_id in ('listing-images','avatars'));

drop policy if exists "Kullanıcı kendi klasörüne yükler" on storage.objects;
create policy "Kullanıcı kendi klasörüne yükler" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-images','avatars')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Kullanıcı kendi görselini siler" on storage.objects;
create policy "Kullanıcı kendi görselini siler" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images','avatars')
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 7) BİLDİRİMLER ----------
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
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
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

-- ---------- 8) SOHBETLER ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a <> user_b)
);
create index if not exists conversations_a_idx on public.conversations (user_a, last_message_at desc);
create index if not exists conversations_b_idx on public.conversations (user_b, last_message_at desc);

create table if not exists public.conversation_state (
  conversation_id uuid references public.conversations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  cleared_at timestamptz,
  blocked boolean not null default false,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  listing_ref jsonb,
  reply_to jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_state enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Sohbet taraflara açık" on public.conversations;
create policy "Sohbet taraflara açık" on public.conversations for select
  using (user_a = auth.uid() or user_b = auth.uid() or public.is_staff());

drop policy if exists "Sohbet açılabilir" on public.conversations;
create policy "Sohbet açılabilir" on public.conversations for insert to authenticated
  with check (auth.uid() in (user_a, user_b) and user_a <> user_b);

drop policy if exists "Sohbet durumu kendi" on public.conversation_state;
create policy "Sohbet durumu kendi" on public.conversation_state for select using (user_id = auth.uid());

drop policy if exists "Sohbet durumu ekle" on public.conversation_state;
create policy "Sohbet durumu ekle" on public.conversation_state for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Sohbet durumu güncelle" on public.conversation_state;
create policy "Sohbet durumu güncelle" on public.conversation_state for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Mesajlar taraflara açık" on public.messages;
create policy "Mesajlar taraflara açık" on public.messages for select
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
         or public.is_staff());

drop policy if exists "Mesaj gönderme" on public.messages;
create policy "Mesaj gönderme" on public.messages for insert to authenticated
  with check (sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())));

drop policy if exists "Mesaj silme kendi" on public.messages;
create policy "Mesaj silme kendi" on public.messages for delete to authenticated
  using (sender_id = auth.uid());

-- Mesaj gelince sohbet sırası güncellenir (bildirim gönderilmez)
create or replace function public.on_message_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sadece sohbet sırasını günceller; mesajlar bildirim kutusuna düşmez
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end; $$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
for each row execute function public.on_message_created();

-- ---------- 9) SATIŞLAR ----------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending_buyer'
    check (status in ('pending_buyer','confirmed','approved','declined','cancelled')),
  auto_approve_at timestamptz not null default now() + interval '24 hours',
  buyer_confirmed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sales_seller_idx on public.sales (seller_id, created_at desc);
create index if not exists sales_buyer_idx on public.sales (buyer_id, created_at desc);

alter table public.sales enable row level security;

drop policy if exists "Satış taraflara açık" on public.sales;
create policy "Satış taraflara açık" on public.sales for select
  using (seller_id = auth.uid() or buyer_id = auth.uid() or public.is_staff());

drop policy if exists "Satış oluşturma" on public.sales;
create policy "Satış oluşturma" on public.sales for insert to authenticated
  with check (seller_id = auth.uid() and exists (
    select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

drop policy if exists "Satış güncelleme" on public.sales;
create policy "Satış güncelleme" on public.sales for update to authenticated
  using (seller_id = auth.uid() or buyer_id = auth.uid() or public.is_staff())
  with check (seller_id = auth.uid() or buyer_id = auth.uid() or public.is_staff());

create or replace function public.mark_sold(p_listing uuid, p_buyer uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sale uuid; v_title text; v_seller uuid;
begin
  select title, seller_id into v_title, v_seller from public.listings where id = p_listing;
  if v_seller is null or v_seller <> auth.uid() then raise exception 'Bu ilanın sahibi değilsin'; end if;
  if p_buyer = auth.uid() then raise exception 'Kendine satış yapamazsın'; end if;

  -- Aynı alıcıyla kısa süre içinde tekrar satış bildirilemez
  if exists (
    select 1 from public.sales
    where seller_id = v_seller
      and buyer_id = p_buyer
      and created_at > now() - interval '2 hours'
  ) then
    raise exception 'Bu kişi için satış bildirimi zaten yapıldı, biraz sonra tekrar dene';
  end if;

  -- Satış bildirimleri arasında kısa bir bekleme süresi var
  if exists (
    select 1 from public.sales
    where seller_id = v_seller
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Çok sık satış bildirimi yapılıyor, biraz sonra tekrar dene';
  end if;

  insert into public.sales (listing_id, seller_id, buyer_id)
  values (p_listing, v_seller, p_buyer)
  returning id into v_sale;

  perform public.notify(p_buyer, 'sale', 'Satış bildirimi',
    v_title || ' ilanı için satış bildirildi. Doğru mu?', '/siparisler');
  return v_sale;
end; $$;
grant execute on function public.mark_sold(uuid, uuid) to authenticated;

create or replace function public.buyer_confirm(p_sale uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_sale public.sales; v_title text;
begin
  select * into v_sale from public.sales where id = p_sale;
  if v_sale is null or v_sale.buyer_id <> auth.uid() then raise exception 'Yetkisiz'; end if;
  select title into v_title from public.listings where id = v_sale.listing_id;

  if p_accept then
    update public.sales set status = 'confirmed', buyer_confirmed_at = now() where id = p_sale;
    perform public.notify(v_sale.seller_id, 'sale', 'Satış onaylandı',
      v_title || ' için alıcı satışı doğruladı.', '/siparisler');
  else
    update public.sales set status = 'declined' where id = p_sale;
    perform public.notify(v_sale.seller_id, 'sale', 'Satış reddedildi',
      v_title || ' için alıcı satışı reddetti. Destek talebi açabilirsin.', '/diger/destek');
  end if;
end; $$;
grant execute on function public.buyer_confirm(uuid, boolean) to authenticated;

create or replace function public.approve_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_sale public.sales; v_title text;
begin
  select * into v_sale from public.sales where id = p_sale;
  if v_sale is null or (v_sale.buyer_id <> auth.uid() and not public.is_staff()) then raise exception 'Yetkisiz'; end if;
  if v_sale.status = 'approved' then return; end if;

  select title into v_title from public.listings where id = v_sale.listing_id;
  update public.sales set status = 'approved', approved_at = now() where id = p_sale;
  update public.profiles set sales_count = coalesce(sales_count,0) + 1 where id = v_sale.seller_id;
  perform public.notify(v_sale.seller_id, 'sale', 'Satış tamamlandı',
    v_title || ' satışı onaylandı. Başarılı işlem sayın arttı.', '/profil');
  perform public.notify(v_sale.buyer_id, 'review', 'Siparişi değerlendir',
    v_title || ' için satıcıyı değerlendir.', '/siparisler');
end; $$;
grant execute on function public.approve_sale(uuid) to authenticated;

-- 24 saatte yanıt gelmezse otomatik onay
create or replace function public.resolve_sales()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0;
begin
  for r in select * from public.sales where status in ('pending_buyer','confirmed') and auto_approve_at < now()
  loop
    update public.sales set status = 'approved', approved_at = now() where id = r.id;
    update public.profiles set sales_count = coalesce(sales_count,0) + 1 where id = r.seller_id;
    perform public.notify(r.buyer_id, 'review', 'Sipariş otomatik onaylandı',
      'Satış 24 saat içinde onaylanmadığı için otomatik onaylandı. Değerlendirebilirsin.', '/siparisler');
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
grant execute on function public.resolve_sales() to authenticated;

-- ---------- 10) DEĞERLENDİRMELER ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid unique references public.sales (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  satisfaction smallint not null check (satisfaction between 1 and 5),
  trust smallint not null check (trust between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  delivery smallint not null check (delivery between 1 and 5),
  overall smallint not null check (overall between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_seller_idx on public.reviews (seller_id, created_at desc);
create index if not exists reviews_listing_idx on public.reviews (listing_id);

alter table public.reviews enable row level security;

drop policy if exists "Değerlendirmeler herkese açık" on public.reviews;
create policy "Değerlendirmeler herkese açık" on public.reviews for select using (true);

drop policy if exists "Değerlendirme yazma" on public.reviews;
create policy "Değerlendirme yazma" on public.reviews for insert to authenticated
  with check (buyer_id = auth.uid());

create or replace function public.after_review_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p set
    rating = (select round(avg(overall)::numeric, 2) from public.reviews where seller_id = new.seller_id),
    review_count = (select count(*) from public.reviews where seller_id = new.seller_id)
  where p.id = new.seller_id;

  perform public.notify(new.seller_id, 'review', 'Yeni değerlendirme',
    'Bir alıcı seni ' || new.overall || '/5 puanla değerlendirdi.', '/profil');
  return new;
end; $$;

drop trigger if exists reviews_after_insert on public.reviews;
create trigger reviews_after_insert after insert on public.reviews
for each row execute function public.after_review_insert();

-- ---------- 11) DESTEK TALEPLERİ ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;

drop policy if exists "Talep kendi veya yetkili" on public.support_tickets;
create policy "Talep kendi veya yetkili" on public.support_tickets for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "Talep oluşturma" on public.support_tickets;
create policy "Talep oluşturma" on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Talep güncelleme yetkili" on public.support_tickets;
create policy "Talep güncelleme yetkili" on public.support_tickets for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- 12) ONAYLI SATICI BAŞVURULARI ----------
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  created_at timestamptz not null default now()
);
alter table public.seller_applications enable row level security;

drop policy if exists "Başvuru kendi veya yetkili" on public.seller_applications;
create policy "Başvuru kendi veya yetkili" on public.seller_applications for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "Başvuru oluşturma" on public.seller_applications;
create policy "Başvuru oluşturma" on public.seller_applications for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Başvuru güncelleme yetkili" on public.seller_applications;
create policy "Başvuru güncelleme yetkili" on public.seller_applications for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- 13) ÖNE ÇIKARMA TALEPLERİ ----------
create table if not exists public.featured_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  days integer not null check (days in (1,3,7)),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.featured_requests enable row level security;

drop policy if exists "Öne çıkarma kendi veya yetkili" on public.featured_requests;
create policy "Öne çıkarma kendi veya yetkili" on public.featured_requests for select
  using (seller_id = auth.uid() or public.is_staff());

drop policy if exists "Öne çıkarma talep" on public.featured_requests;
create policy "Öne çıkarma talep" on public.featured_requests for insert to authenticated
  with check (seller_id = auth.uid());

drop policy if exists "Öne çıkarma güncelle yetkili" on public.featured_requests;
create policy "Öne çıkarma güncelle yetkili" on public.featured_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- 14) BİLDİRİLER (şikayet) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewed','closed')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

drop policy if exists "Şikayet kendi veya yetkili" on public.reports;
create policy "Şikayet kendi veya yetkili" on public.reports for select
  using (reporter_id = auth.uid() or public.is_staff());

drop policy if exists "Şikayet oluşturma" on public.reports;
create policy "Şikayet oluşturma" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "Şikayet güncelle yetkili" on public.reports;
create policy "Şikayet güncelle yetkili" on public.reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- 15) TAG'LER ----------
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

-- ---------- 16) DUYURULAR ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;

drop policy if exists "Duyuru herkese açık" on public.announcements;
create policy "Duyuru herkese açık" on public.announcements for select using (true);

drop policy if exists "Duyuru yazma kurucu" on public.announcements;
create policy "Duyuru yazma kurucu" on public.announcements for insert to authenticated
  with check (public.my_staff_role() = 'owner');

-- ---------- 17) KURUCU ----------
create or replace function public.grant_owner_by_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'srcuveys@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'owner')
    on conflict (user_id) do update set role = 'owner';
  end if;
  return new;
end; $$;

drop trigger if exists grant_owner_on_signup on auth.users;
create trigger grant_owner_on_signup after insert on auth.users
for each row execute function public.grant_owner_by_email();

insert into public.user_roles (user_id, role) select id, 'owner' from auth.users
where lower(email) = 'srcuveys@gmail.com'
on conflict (user_id) do update set role = 'owner';

-- ---------- 18) YETKİLİ İŞLEMLERİ ----------
create or replace function public.admin_set_tag(p_user uuid, p_tag text, p_remove boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_remove then
    delete from public.user_tags where user_id = p_user and tag = p_tag;
    if p_tag = 'verified_seller' then
      update public.profiles set verified_seller = false where id = p_user;
    end if;
  else
    insert into public.user_tags (user_id, tag, granted_by)
    values (p_user, p_tag, auth.uid()) on conflict (user_id, tag) do nothing;
    if p_tag = 'verified_seller' then
      update public.profiles set verified_seller = true where id = p_user;
    end if;
  end if;
end; $$;
grant execute on function public.admin_set_tag(uuid, text, boolean) to authenticated;

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

-- ---------- 19) ÖNBELLEK + DOĞRULAMA ----------
-- Yeni fonksiyonların API'de hemen görünmesi için PostgREST şemasını yenile
notify pgrst, 'reload schema';

select proname as "fonksiyon", 'var' as "durum"
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('my_staff_role','is_staff','email_for_username','notify','mark_sold',
                  'buyer_confirm','approve_sale','resolve_sales','admin_set_tag','admin_set_role')
order by 1;


-- ============================================================
--  v4 EKLENTİLERİ
-- ============================================================
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

-- ---------- 6) ÖNBELLEK ----------
notify pgrst, 'reload schema';

-- ============================================================
--  SON KONTROL — hepsi "var" görünmeli
-- ============================================================
notify pgrst, 'reload schema';

select 'tablo: ' || tablename as kontrol, 'var' as durum
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','listings','user_roles','user_tags','user_frames','notifications',
                    'conversations','conversation_state','messages','sales','reviews',
                    'support_tickets','seller_applications','featured_requests','reports',
                    'announcements','user_blocks')
union all
select 'fonksiyon: ' || proname, 'var'
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('my_staff_role','is_staff','email_for_username','notify','mark_sold',
                  'buyer_confirm','approve_sale','resolve_sales','admin_set_tag','admin_set_role',
                  'admin_set_frame','admin_set_banned','admin_delete_account','admin_feature_listing',
                  'admin_set_listing_status','admin_remove_role','expire_listings','renew_listing',
                  'admin_notify','is_blocked_between','reply_review','admin_delete_review',
                  'admin_clear_reviews','admin_set_sales_count','admin_sync_sales_count','send_message')
union all
select 'depo: ' || id, 'var' from storage.buckets where id in ('avatars','listing-images')
order by 1;
