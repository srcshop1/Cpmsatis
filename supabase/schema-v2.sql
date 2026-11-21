-- ============================================================
--  CPM Satış · v2: İlanlar, görseller, roller
--  SQL Editor > New query > yapıştır > Run
--  (schema.sql'den SONRA çalıştır. Tekrar çalıştırılabilir.)
-- ============================================================

-- ------------------------------------------------------------
-- 1) PROFİL EKLERİ
-- ------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists verified_seller boolean not null default false;

create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- ------------------------------------------------------------
-- 2) ROLLER (herkese kapalı)
--    Kurucu/mod rolü profillerde GÖRÜNMEZ; sadece bu tabloda.
-- ------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'moderator')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
-- Hiçbir istemci okuyamaz/yazamaz. Sadece aşağıdaki fonksiyonlar.

create or replace function public.my_staff_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;

grant execute on function public.my_staff_role() to authenticated;

create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

grant execute on function public.is_staff() to authenticated;

-- ------------------------------------------------------------
-- 3) İLANLAR
-- ------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 72),
  description_html text,
  price numeric(12, 2) not null check (price >= 0 and price <= 50000000),
  category text not null check (category in ('cpm1', 'cpm2', 'takas', 'satilik', 'cizim', 'krom')),
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'sold', 'hidden', 'removed')),
  featured_until timestamptz,
  featured_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_created_idx on public.listings (created_at desc);
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_price_idx on public.listings (price);
create index if not exists listings_seller_idx on public.listings (seller_id);
create index if not exists listings_featured_idx on public.listings (featured_until desc nulls last);

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_updated_at();

alter table public.listings enable row level security;

drop policy if exists "Satılık ilanlar herkese açık" on public.listings;
create policy "Satılık ilanlar herkese açık"
  on public.listings for select
  using (status = 'active' or seller_id = auth.uid() or public.is_staff());

drop policy if exists "Kullanıcı kendi ilanını açar" on public.listings;
create policy "Kullanıcı kendi ilanını açar"
  on public.listings for insert
  to authenticated
  with check (seller_id = auth.uid());

drop policy if exists "Kullanıcı kendi ilanını günceller" on public.listings;
create policy "Kullanıcı kendi ilanını günceller"
  on public.listings for update
  to authenticated
  using (seller_id = auth.uid() or public.is_staff())
  with check (seller_id = auth.uid() or public.is_staff());

drop policy if exists "Kullanıcı kendi ilanını siler" on public.listings;
create policy "Kullanıcı kendi ilanını siler"
  on public.listings for delete
  to authenticated
  using (seller_id = auth.uid() or public.is_staff());

-- ------------------------------------------------------------
-- 4) GÖRSELLER (Supabase Storage)
--    Her görsel en fazla 8 MB, ilan başına 6 adet (uygulama kontrol eder).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "İlan görselleri herkese açık" on storage.objects;
create policy "İlan görselleri herkese açık"
  on storage.objects for select
  using (bucket_id = 'listing-images');

drop policy if exists "Kullanıcı kendi klasörüne görsel yükler" on storage.objects;
create policy "Kullanıcı kendi klasörüne görsel yükler"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Kullanıcı kendi görselini siler" on storage.objects;
create policy "Kullanıcı kendi görselini siler"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 5) SON GÖRÜLME (çevrimiçi satıcı filtresi)
-- ------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;

-- ------------------------------------------------------------
-- 6) KURUCU HESABI (yalnızca tanımlı e-posta)
--    Rol sadece user_roles tablosunda tutulur; profillerde
--    "KURUCU" etiketi görünmez.
-- ------------------------------------------------------------
create or replace function public.grant_owner_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'srcuveys@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'owner')
    on conflict (user_id) do update set role = 'owner';
  end if;
  return new;
end;
$$;

drop trigger if exists grant_owner_on_signup on auth.users;
create trigger grant_owner_on_signup
  after insert on auth.users
  for each row execute function public.grant_owner_by_email();

-- Hesap zaten açıldıysa hemen yetkilendir
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where lower(email) = 'srcuveys@gmail.com'
on conflict (user_id) do update set role = 'owner';
