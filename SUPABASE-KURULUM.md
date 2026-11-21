# Supabase Kurulumu — 4 adım

Site anahtarlar yokken **demo modunda** çalışır. Anahtarları girince gerçek veritabanına geçer.

---

## 1) Hepsini tek seferde kur (tek dosya)

1. Supabase panelinde sol menüden **SQL Editor** → **New query**.
2. Bu repodaki **`supabase/HEPSI.sql`** dosyasının **tamamını** kopyala, yapıştır.
3. **Run** (Ctrl + Enter). En sonda `kontrol | durum` diye bir liste çıkar; her satırda **var** yazmalı.

Bu tek dosya her şeyi kurar/onarır: profiller, ilanlar (çoklu kategori, 15 gün süre),
sohbetler, satışlar, değerlendirmeler, destek talepleri, onaylı satıcı başvuruları,
öne çıkarma, bildiriler, taglar, duyurular, roller, depo kovaları (avatars, listing-images),
tüm yetki (RLS) kuralları ve fonksiyonlar.

> Tekrar tekrar çalıştırılabilir, veri silmez. `schema-v3.sql` / `schema-v4.sql` / `onarim.sql`
> dosyalarının hepsi bunun içinde.

## 2) Kurucu hesabını aç

1. **Authentication → Users → Add user → Create new user**.
2. E-posta: `srcuveys@gmail.com`
3. Şifre: `srcshop123?`
4. **Auto Confirm User** işaretli olsun → **Create user**.

Kurucu tag'i şemada tanımlı olduğu için bu e-posta otomatik **KURUCU** olur.
(Sonradan açtıysan 1. adımı tekrar çalıştır, yine kurucu olur.)

---

## 3) E-posta doğrulamasını kapat (test için)

**Authentication → Sign In / Providers → Email** → **Confirm email** kapalı → **Save**.

**Authentication → URL Configuration**:
- **Site URL:** `http://localhost:3000` (canlıda kendi adresin)
- **Redirect URLs:** `http://localhost:3000/**`

---

## 4) Anahtarları yaz

**Project Settings → API** sayfasından iki değeri al:

- **Project URL** → `https://xxxxx.supabase.co`
- **anon / publishable** key → `sb_publishable_...` veya `eyJ...`

Sonra repo kökünde `.env.local` dosyası:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Sunucuyu yeniden başlat: `npm run dev`.

> `service_role` / secret anahtarı **gerekmez**, tarayıcıya da koymayız. Yetkiyi RLS sağlar.

---

## Kontrol listesi

- `/durum` sayfasını aç → "Bağlantı: tamam" görünmeli.
- `/kayit` ile yeni hesap aç → **Table Editor → profiles** tablosunda satır görünmeli.
- Kurucu hesapla gir → **Diğer → Yetkili Panelleri** görünmeli, içinde 8 sekme olmalı.
- Bir ilan oluştur → `/ilanlar` sayfasında kendi ilanın görünmeli.
- Başka bir hesapla o ilana mesaj at → `/mesajlar` iki tarafta da görünmeli.

## Sık gelen hatalar

| Belirti | Çözüm |
| --- | --- |
| "E-posta veya şifre yanlış" | Hesap gerçekten var mı? **Authentication → Users** listesine bak. Yoksa 2. adımı yap. |
| "Bu kullanıcı adında biri yok" | 1. adım çalıştırılmamış olabilir; `profiles` ve `email_for_username` gerekli. |
| Görsel yüklenmiyor | 1. adım storage kovalarını (`avatars`, `listing-images`) oluşturur; SQL'i tekrar çalıştır. |
| "new row violates row-level security" | SQL dosyası yarım çalışmış; tamamını baştan çalıştır. |
| Demo modu uyarısı | `.env.local` kaydedilmemiş ya da sunucu yeniden başlatılmamış. |
