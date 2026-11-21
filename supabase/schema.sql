-- ============================================================
--  CPM Satış · Supabase veritabanı kurulumu (v1)
--  Supabase panelinde: SQL Editor > New query > bu dosyayı yapıştır > Run
--  Tekrar çalıştırılabilir (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1) PROFİLLER
--    auth.users tablosu Supabase'e ait; kullanıcı adını orada
--    tutamayacağımız için her kullanıcıya 1 satırlık profil açıyoruz.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text,
  avatar_url text,
  rating numeric(3, 2) default 5.00,
  sales_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Kullanıcı profilleri: kullanıcı adı, e-posta, satıcı bilgileri.';

-- Kullanıcı adı büyük/küçük harf duyarsız benzersiz olsun (Ali = ali)
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- ------------------------------------------------------------
-- 2) YENİ KULLANICI -> OTOMATİK PROFİL
--    Kayıt formundan gelen username (user_metadata) profile yazılır.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3) KULLANICI ADIYLA GİRİŞ DESTEĞİ
--    Kullanıcı adı -> e-posta çözer. Giriş ekranı "kullanıcı adı
--    veya e-posta" kabul ettiği için bu fonksiyon gerekli.
--    Sadece e-posta döndürür, şifre asla.
-- ------------------------------------------------------------
create or replace function public.email_for_username(uname text)
returns text
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(uname))
  limit 1;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4) SATIR DÜZEYİ GÜVENLİK (RLS)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Profiller herkese açık okunur" on public.profiles;
create policy "Profiller herkese açık okunur"
  on public.profiles for select
  using (true);

drop policy if exists "Kullanıcı kendi profilini günceller" on public.profiles;
create policy "Kullanıcı kendi profilini günceller"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert yalnızca trigger (security definer) üzerinden yapılır.

-- ------------------------------------------------------------
-- 5) updated_at otomatiği
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
