# CPM Satış

itemsatis tarzı dijital ürün pazar yeri. Bu sürümde **kimlik doğrulama** (kayıt / giriş) ve
panel vitrini hazır: Supabase Auth + Postgres, açık oturumlar, kullanıcı adıyla giriş.

## Özellikler

- **Kayıt ol:** Kullanıcı Adı · E-Posta · Şifre · Şifre Tekrar (+ "Kayıt Ol")
  - Şifre en az **6 karakter**, canlı doğrulama ve eşleşme kontrolü
  - Kullanıcı adı büyük/küçük harf duyarsız benzersiz
- **Giriş yap:** **Kullanıcı Adı veya E-Posta** + Şifre, tek form
- **Basit kullanım:** tek arama kutusu, tek dokunuşla kategoriler, hızlı işlem kutuları
- **Panel:** kişisel karşılama, arama, kategori filtreleri, örnek ilan vitrini
- **Supabase yapılandırılmadıysa** yerel **demo modu** ile site tamamen çalışır

## Teknolojiler

- Next.js 15 (App Router, Server Actions) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- Yerel demo modu için `node:crypto` + dosya tabanlı depo

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local   # Supabase anahtarlarını gir (opsiyonel)
npm run dev                  # http://localhost:3000
```

Anahtar girmezsen site **demo modunda** açılır; hesaplar `.data/` içinde saklanır.

Supabase kurulumu: **[SUPABASE-KURULUM.md](./SUPABASE-KURULUM.md)**
Veritabanı betiği: **[supabase/schema.sql](./supabase/schema.sql)**

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (0.0.0.0:3000) |
| `npm run build` | Üretim derlemesi |
| `npm start` | Üretim sunucusu |

## Klasör yapısı

```
app/
  page.tsx              # Ana sayfa (hero, kategoriler, ilanlar)
  kayit/page.tsx        # Kayıt ol
  giris/page.tsx        # Giriş yap
  panel/page.tsx        # Oturum sonrası panel
  actions/auth.ts       # Sunucu action'ları (kayıt, giriş, çıkış)
components/
  auth/                 # Formlar + auth yerleşimi
  site-header.tsx       # Üst menü
  listing-card.tsx      # İlan kartı
lib/
  auth/                 # Oturum, mod seçimi, demo deposu
  supabase/             # Supabase istemcileri
  validation.ts         # Form doğrulama kuralları
  catalog.ts            # Kategoriler + örnek ilanlar
supabase/schema.sql     # Tablolar, trigger, RLS, RPC
```

## Yol haritası

- [ ] İlan verme ve ilan detay sayfası (DB'ye bağlı)
- [ ] Sepet / güvenli ödeme akışı (escrow mantığı)
- [ ] Satıcı paneli, siparişler, mesajlaşma
- [ ] Admin paneli ve moderasyon
- [ ] E-posta doğrulama, şifre sıfırlama

## Güvenlik notları

- Yalnızca **anon** anahtarı kullanılır; yetki kontrolü Supabase RLS ile yapılır.
- `email_for_username` fonksiyonu kullanıcı adından e-posta çözer (kullanıcı adıyla giriş için
  gerekli). Kullanıcı adı gizliliği kritikse e-posta ile girişi zorunlu tut.
- Demo modu yalnızca geliştirme içindir; üretimde Supabase anahtarlarını kullan.
