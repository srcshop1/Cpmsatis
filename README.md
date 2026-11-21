# CPM Satış

CPM (Car Parking Multiplayer) araç, çizim ve hesap alım-satımı için itemsatis tarzı
pazar yeri. **Sitede ödeme alınmaz, direkt satın alma yoktur** — anlaşma satıcı ile alıcı
arasında mesajlaşarak yapılır.

## Neler var

- **İlanlar:** arama + filtre (kategori çoklu seçim, min/maks fiyat, yalnızca çevrimiçi
  satıcı, 10+ başarılı işlem), kare kartlar, orijinal boyutlu detay galerisi.
- **İlan oluştur:** en fazla 6 görsel, 72 karakter başlık, zengin metin açıklama,
  zorunlu fiyat (0 – 50.000.000 ₺), **çoklu kategori** (en az 1), "İlanı Öne Çıkar".
- **İlan ömrü 15 gün:** süresi dolan ilan listeden kalkar, sahibi "İlanı Yenile" ile uzatır.
- **Filtreler:** kategori, fiyat aralığı, çevrimiçi satıcı, 10+ işlem, **yalnızca onaylı satıcı**.
- **Mesajlar:** sohbet listesi, gerçek zamanlıya yakın yazışma, üç nokta menüsü
  (engelle / sohbeti temizle / bildir — 10 sebep + açıklama).
- **Satış akışı:** "Satış yaptım" → müşteri seç → alıcı onayı → "Siparişi Onayla" →
  başarılı işlem +1, 24 saatte yanıt gelmezse otomatik onay. Sonrasında 5 eksenli değerlendirme.
- **Profil:** fotoğraf, kullanıcı adı ve şifre değiştirme, çerçeveler, değerlendirme ortalamaları.
- **Diğer:** SSS (15 soru), destek talebi, onaylı satıcı başvurusu, canlı destek (yakında).
- **Yetkili paneli:** destek, onaylı satıcı, öne çıkarma, bildiriler, **ilan yönetimi**,
  **üyeler (ban / hesap sil / rol)**, satışlar, tag ver/al, duyurular ve istatistik.
- **Rozetler:** Onaylı Satıcı için mavi tik + "Onaylı Satıcı" etiketi, kurucu/moderatör
  etiketi herkese görünür; profil çerçeveleri avatarın her yerinde çalışır.

## Teknolojiler

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (`@supabase/supabase-js`) — istemci tarayıcıda, yetki RLS ile
- Anahtar yoksa **demo modu**: hesaplar tarayıcıda (localStorage) tutulur

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local   # Supabase anahtarlarını gir (opsiyonel)
npm run dev                  # http://localhost:3000
```

Supabase kurulumu: **[SUPABASE-KURULUM.md](./SUPABASE-KURULUM.md)**
Veritabanı betiği: **[supabase/schema-v3.sql](./supabase/schema-v3.sql)**

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (0.0.0.0:3000) |
| `npm run build` | Üretim derlemesi |
| `npm start` | Üretim sunucusu |

## Klasör yapısı

```
app/
  page.tsx              # Ana sayfa
  ilanlar/              # İlan listesi + filtreler
  ilan/[id]/            # İlan detayı
  ilan/olustur/         # İlan oluştur
  mesajlar/             # Sohbet listesi + sohbet
  siparisler/           # Satış onayları + değerlendirme
  bildirimler/          # Bildirimler
  profil/               # Profil ayarları
  diger/                # SSS, destek, onaylı satıcı
  yetkili/              # Kurucu / moderatör paneli
components/
  auth/                 # Formlar, AuthProvider, auth yerleşimi
  site-header.tsx       # Üst menü
  listing-card.tsx      # İlan kartı
lib/
  auth/                 # Tipler + tarayıcı demo deposu
  supabase/             # Supabase istemcileri
  validation.ts         # Form doğrulama kuralları
  catalog.ts            # Kategoriler + örnek ilanlar
supabase/schema-v3.sql # Tablolar, trigger, RLS, RPC (tek dosya)
```

## Yol haritası

- [x] İlan verme, ilan listesi/detay, filtreler
- [x] Satış akışı, değerlendirmeler, mesajlaşma
- [x] Yetkili paneli (kurucu + moderatör)
- [ ] Canlı destek (gerçek zamanlı operatör)
- [ ] E-posta değiştirme, şifre sıfırlama, e-posta doğrulama

## Güvenlik notları

- Yalnızca **anon/publishable** anahtar kullanılır; yetki kontrolü Supabase RLS ile yapılır.
- Oturum tarayıcıda tutulur; sunucuya şifre/anahtar gitmez.
- `email_for_username` fonksiyonu kullanıcı adından e-posta çözer (kullanıcı adıyla giriş için
  gerekli). Kullanıcı adı gizliliği kritikse e-posta ile girişi zorunlu tut.
- Demo modu yalnızca geliştirme içindir; üretimde Supabase anahtarlarını kullan.
