# Supabase Kurulumu (adım adım)

Bu proje iki modda çalışır:

| Mod | Ne zaman | Veri nerede |
| --- | --- | --- |
| **Demo modu** | Supabase anahtarları boşsa | Tarayıcıda (localStorage), sadece deneme için |
| **Supabase modu** | `.env.local` içinde URL + anon key varsa | Supabase Postgres + Supabase Auth |

Anahtarları girdiğin an site otomatik olarak Supabase'e geçer — kodda değişiklik gerekmez.

---

## 1. Supabase projesi aç

1. [supabase.com/dashboard](https://supabase.com/dashboard) adresine gir, GitHub ile giriş yap.
2. **New project** düğmesine bas.
3. Ayarlar:
   - **Name:** `cpmsatis`
   - **Database Password:** güçlü bir şifre (bir yere kaydet)
   - **Region:** `Frankfurt (eu-central-1)` — Türkiye'ye en yakın bölgelerden biri
4. **Create new project** → proje hazırlanırken ~2 dakika bekle.

---

## 2. Veritabanı tablolarını oluştur

1. Sol menüden **SQL Editor** → **New query**.
2. Bu repodaki **`supabase/schema.sql`** dosyasının tamamını kopyalayıp yapıştır.
3. **Run** (veya `Ctrl + Enter`).

Bu betik şunları yapar:

- `profiles` tablosu (kullanıcı adı, e-posta, puan, satış sayısı)
- Kullanıcı adı büyük/küçük harf duyarsız **benzersiz** (Ali = ali)
- Kayıt olan her kullanıcı için otomatik profil oluşturan trigger
- **Kullanıcı adıyla giriş** için `email_for_username()` fonksiyonu
- Satır düzeyi güvenlik (RLS) politikaları

> Kontrol: **Table Editor → profiles** tablosunu görüyor olmalısın.

---

## 3. E-posta doğrulamasını ayarla

Hemen test etmek için en pratik ayar, doğrulamayı kapatmaktır:

1. **Authentication → Sign In / Providers → Email**
2. **Confirm email** seçeneğini **kapat** (geliştirme için).
3. **Save**.

> Üretime çıkarken bunu tekrar **aç**. Açıkken kayıt sonrası kullanıcı e-postasındaki
> bağlantıya tıklamalıdır; kod bu durumda kullanıcıya "e-postanı doğrula" mesajı gösterir.

Ayrıca **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (canlıda kendi alan adın)
- **Redirect URLs:** `http://localhost:3000/**`

---

## 4. API anahtarlarını al

1. **Project Settings (dişli) → API Keys** (yeni panelde *Project Settings → API*).
2. Şu iki değeri kopyala:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon / public** key (`eyJ...` veya `sb_publishable_...`)

> ⚠️ **service_role** anahtarını asla tarayıcıya / `NEXT_PUBLIC_` değişkenine koyma.
> Bu proje yalnızca **anon** anahtarını kullanır; yetki kontrolü RLS ile yapılır.

---

## 5. Anahtarları projeye yaz

Repo kökünde `.env.local` dosyası oluştur (`.env.example`'ı kopyalayabilirsin):

```bash
cp .env.example .env.local
```

İçini doldur:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...buraya-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> Anahtarlar `NEXT_PUBLIC_` olduğu için tarayıcıya gider. Bu normaldir: anon/publishable
> anahtarı herkese açık olacak şekilde tasarlanmıştır. Güvenliği RLS sağlar.

---

## 6. Yeniden başlat ve test et

```bash
npm run dev
```

- `http://localhost:3000/kayit` → kayıt ol
- **Supabase → Authentication → Users** listesinde kullanıcı görünmeli
- **Table Editor → profiles** tablosunda `username` satırı görünmeli
- Çıkış yap → `/giris` → **kullanıcı adıyla** giriş yap (e-posta ile de çalışır)

Hâlâ "Demo modu" uyarısı görüyorsan: `.env.local` kaydedildi mi, sunucu yeniden
başlatıldı mı kontrol et. (Ortam değişkenleri sadece başlangıçta okunur.)

---

## 7. Sık karşılaşılan hatalar

| Belirti | Çözüm |
| --- | --- |
| `email_for_username` fonksiyonu bulunamadı | `schema.sql` çalıştırılmamış. SQL Editor'de tekrar çalıştır. |
| Kayıttan sonra "e-postanı doğrula" mesajı | 3. adımda *Confirm email* kapatılmalı ya da e-postadaki linke tıklanmalı. |
| `Invalid login credentials` | Şifre yanlış ya da kullanıcı e-postası doğrulanmamış. |
| Kayıt "already registered" hatası | Bu e-posta zaten kayıtlı; farklı e-posta kullan. |
| `new row violates row-level security policy` | `schema.sql` tam çalıştırılmamış; RLS politikalarını kontrol et. |
| Kullanıcı adı "alınmış" görünüyor ama kullanıcı yok | `profiles` tablosunda eski/artık satır olabilir; sil ve tekrar dene. |

---

## 8. Üretime çıkarken kontrol listesi

- [ ] *Confirm email* açık + kendi SMTP sunucun (Supabase varsayılan göndericisi sınırlıdır)
- [ ] `AUTH_SECRET` güçlü ve gizli
- [ ] `Site URL` ve `Redirect URLs` gerçek alan adına ayarlı
- [ ] CAPTCHA / rate limit (Authentication → Attack Protection)
- [ ] Tüm tablolarda RLS açık
- [ ] `service_role` anahtarı sadece sunucu tarafında, `NEXT_PUBLIC_` olmadan

---

## Demo verilerini sıfırlama

Supabase olmadan deneme yaptıysan hesaplar tarayıcının `localStorage` alanındadır.
Tarayıcı konsolunda şunu çalıştırıp sayfayı yenile:

```js
localStorage.clear()
```
