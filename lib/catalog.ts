export type Category = {
  slug: string;
  name: string;
  icon: string;
  blurb: string;
};

export const categories: Category[] = [
  { slug: "oyun-hesaplari", name: "Oyun Hesapları", icon: "🎮", blurb: "Valorant, PUBG, LoL" },
  { slug: "oyun-ici", name: "Oyun İçi Ürünler", icon: "💎", blurb: "Skin, UC, RP, elmas" },
  { slug: "sosyal-medya", name: "Sosyal Medya", icon: "📱", blurb: "Hazır hesaplar" },
  { slug: "abonelik", name: "Abonelikler", icon: "🎬", blurb: "Dizi, film, müzik" },
  { slug: "yazilim", name: "Yazılım & Lisans", icon: "🧩", blurb: "Key, lisans, araçlar" },
  { slug: "hizmet", name: "Dijital Hizmet", icon: "🛠️", blurb: "Tasarım, yazılım, destek" },
  { slug: "egitim", name: "Eğitim", icon: "🎓", blurb: "Kurs, ders, kaynak" },
  { slug: "diger", name: "Diğer", icon: "✨", blurb: "Aradığın her şey" },
];

/** Panelde tasarımı göstermek için kullanılan örnek ilanlar (gerçek veri değil). */
export type DemoListing = {
  id: string;
  title: string;
  category: string;
  price: number;
  seller: string;
  rating: number;
  sales: number;
  delivery: string;
  icon: string;
};

export const demoListings: DemoListing[] = [
  {
    id: "d1",
    title: "Valorant • Asil 2 hesap • 45 skin",
    category: "Oyun Hesapları",
    price: 749,
    seller: "progame",
    rating: 4.9,
    sales: 214,
    delivery: "Anında",
    icon: "🎯",
  },
  {
    id: "d2",
    title: "PUBG Mobile 810 UC • güvenli yükleme",
    category: "Oyun İçi Ürünler",
    price: 189,
    seller: "uctrend",
    rating: 4.8,
    sales: 1284,
    delivery: "5 dk",
    icon: "🔫",
  },
  {
    id: "d3",
    title: "Steam cüzdan kodu • 10 $ / TL bakiye",
    category: "Oyun İçi Ürünler",
    price: 429,
    seller: "keymarket",
    rating: 5.0,
    sales: 892,
    delivery: "Anında",
    icon: "🕹️",
  },
  {
    id: "d4",
    title: "Dizi & film izleme • 1 aylık üyelik",
    category: "Abonelikler",
    price: 99,
    seller: "dijitalim",
    rating: 4.7,
    sales: 3410,
    delivery: "10 dk",
    icon: "🍿",
  },
  {
    id: "d5",
    title: "LoL 6500 RP • hesabına anında tanımlanır",
    category: "Oyun İçi Ürünler",
    price: 259,
    seller: "riotpoint",
    rating: 4.9,
    sales: 653,
    delivery: "Anında",
    icon: "⚔️",
  },
  {
    id: "d6",
    title: "Logo + sosyal medya tasarım paketi",
    category: "Dijital Hizmet",
    price: 599,
    seller: "studyo34",
    rating: 4.95,
    sales: 128,
    delivery: "24 saat",
    icon: "🎨",
  },
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
