"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ChevronDownIcon, ChevronLeftIcon } from "@/components/icons";

const faqs = [
  {
    q: "CPM Satış nedir?",
    a: "Car Parking Multiplayer (CPM 1 ve CPM 2) oyuncularının hesap, çizim, krom ve takas ilanları paylaştığı dijital ilan platformudur.",
  },
  {
    q: "Sitede ödeme yapılıyor mu?",
    a: "Hayır. Sitede para transferi, sepet veya ödeme altyapısı yoktur. Anlaşma tamamen alıcı ile satıcı arasında mesajlaşarak yapılır.",
  },
  {
    q: "İlan vermek ücretli mi?",
    a: "Hayır, ilan vermek ücretsizdir. Sınırsız sayıda ilan oluşturabilirsin.",
  },
  {
    q: "Bir ilanı satın almak için ne yapmalıyım?",
    a: "İlanı aç, açıklamayı oku ve 'Satıcı ile İletişime Geç' butonuna bas. İlan otomatik olarak mesaja eklenmiş şekilde sohbet açılır.",
  },
  {
    q: "Kaç görsel yükleyebilirim?",
    a: "Bir ilana en fazla 6 görsel ekleyebilirsin. İlan kartında ilk görsel, ilanın içinde ise tüm görseller sırayla görünür.",
  },
  {
    q: "İlan başlığı ne kadar uzun olabilir?",
    a: "Başlık en fazla 72 karakter olabilir. Açıklama zengin metin editörüyle yazılır (kalın, italik, renk vb.).",
  },
  {
    q: "Fiyat üst sınırı nedir?",
    a: "İlan fiyatı en fazla 50.000.000 TL girilebilir. Fiyat bilgilendirme amaçlıdır; sitede tahsilat yapılmaz.",
  },
  {
    q: "İlanımı öne çıkarabilir miyim?",
    a: "Evet. İlanından 'Öne Çıkar' talebi gönderirsin. VIP ve Premium üyelerin aylık ücretsiz hakkı vardır; diğer talepler yetkili onayından geçer.",
  },
  {
    q: "Onaylı Satıcı nasıl olunur?",
    a: "30+ başarılı işlem, 30+ değerlendirme ve 4.0+ ortalama puan gerekir. Koşullar sağlandığında yetkili mağazanı inceleyip onay verir.",
  },
  {
    q: "Başarılı işlem sayısı nasıl artar?",
    a: "Satıcı 'Satış yaptım' der, müşteri onaylar. Onaylanan her satış başarılı işlem sayısını 1 artırır.",
  },
  {
    q: "Müşteri satışı onaylamazsa ne olur?",
    a: "Müşteri 24 saat içinde cevap vermezse satış otomatik olarak onaylanır. İtiraz ederse destek talebi süreci başlar.",
  },
  {
    q: "Değerlendirme nasıl yapılır?",
    a: "Sipariş onaylandıktan sonra memnuniyet, güvenilirlik, iletişim, teslimat ve genel puanlarını 5 üzerinden verirsin; istersen yorum yazarsın.",
  },
  {
    q: "Satıcıyı engelleyebilir miyim?",
    a: "Evet. Sohbetin sağ üstündeki üç noktadan engelle, sohbeti temizle veya bildir seçeneklerini kullanabilirsin.",
  },
  {
    q: "Bildirimler nerede görünür?",
    a: "Sağ üstteki zil ikonundan Bildirimler sayfasına ulaşırsın. Satış onayı, mesaj ve başvuru sonuçları burada listelenir.",
  },
  {
    q: "Destek ekibine nasıl ulaşırım?",
    a: "Diğer > Destek Talebi bölümünden başlık ve açıklama yazarak talep oluşturabilirsin. Talebin yetkili paneline düşer.",
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <AppShell>
      <Link
        href="/diger"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> Diğer
      </Link>

      <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
        Sıkça Sorulan Sorular
      </h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">
        Merak ettiğin her şey burada. Cevap için soruya dokun.
      </p>

      <div className="mt-5 space-y-2">
        {faqs.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.q} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                aria-expanded={isOpen}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/5 text-[0.65rem] font-bold text-muted-2">
                  {index + 1}
                </span>
                <span className="flex-1 text-[0.85rem] font-semibold">{item.q}</span>
                <ChevronDownIcon
                  width={17}
                  height={17}
                  className={`shrink-0 text-muted-2 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="animate-fade-up border-t border-line-soft px-4 py-3.5 pl-[3.1rem] text-[0.82rem] leading-relaxed text-muted">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
