export type FrameCategory = "tag" | "achievement";

export type FrameRule =
  | { kind: "reviews"; min: number }
  | { kind: "rating"; min: number; reviews: number }
  | { kind: "sales"; min: number }
  | { kind: "response"; max: number }
  | { kind: "member_days"; min: number }
  | { kind: "listings"; min: number }
  | { kind: "views"; min: number }
  | { kind: "favorites"; min: number };

export type Frame = {
  slug: string;
  name: string;
  category: FrameCategory;
  /** Görsel tema (renk + animasyon) */
  theme: string;
  /** Hangi tag / rol açar (başarı çerçevelerinde "achievement") */
  needs: "member" | "verified_seller" | "vip" | "premium" | "moderator" | "owner" | "achievement";
  /** Sıralama: büyük olan daha üstün */
  rank: number;
  hint: string;
  rule?: FrameRule;
};

/** Sadece üye çerçevesi hareketsiz; diğerleri holografik */
export const frames: Frame[] = [
  // ---------------- TAG ÇERÇEVELERİ ----------------
  {
    slug: "member",
    name: "Üye",
    category: "tag",
    theme: "plain",
    needs: "member",
    rank: 0,
    hint: "Herkes kullanabilir",
  },
  {
    slug: "verified_seller",
    name: "Onaylı Satıcı",
    category: "tag",
    theme: "mint",
    needs: "verified_seller",
    rank: 1,
    hint: "Onaylı Satıcı tag'i gerekir",
  },
  {
    slug: "premium",
    name: "Premium",
    category: "tag",
    theme: "violet",
    needs: "premium",
    rank: 2,
    hint: "Premium tag'i gerekir",
  },
  {
    slug: "vip",
    name: "VIP",
    category: "tag",
    theme: "gold",
    needs: "vip",
    rank: 3,
    hint: "VIP tag'i gerekir",
  },
  {
    slug: "moderator",
    name: "Moderatör",
    category: "tag",
    theme: "blue",
    needs: "moderator",
    rank: 4,
    hint: "Moderatör yetkisi gerekir",
  },
  {
    slug: "owner",
    name: "Kurucu",
    category: "tag",
    theme: "rainbow",
    needs: "owner",
    rank: 5,
    hint: "Kurucu yetkisi gerekir",
  },

  // ---------------- BAŞARI ÇERÇEVELERİ ----------------
  {
    slug: "ach_first_sale",
    name: "İlk Satış",
    category: "achievement",
    theme: "bronze",
    needs: "achievement",
    rank: 1,
    hint: "1 başarılı işlem yap",
    rule: { kind: "sales", min: 1 },
  },
  {
    slug: "ach_member_1y",
    name: "Kıdemli",
    category: "achievement",
    theme: "bronze",
    needs: "achievement",
    rank: 2,
    hint: "1 yıllık üye ol",
    rule: { kind: "member_days", min: 365 },
  },
  {
    slug: "ach_sales_10",
    name: "10 İşlem",
    category: "achievement",
    theme: "silver",
    needs: "achievement",
    rank: 3,
    hint: "10 başarılı işlem yap",
    rule: { kind: "sales", min: 10 },
  },
  {
    slug: "ach_reviews_10",
    name: "10 Değerlendirme",
    category: "achievement",
    theme: "silver",
    needs: "achievement",
    rank: 3,
    hint: "10 değerlendirme al",
    rule: { kind: "reviews", min: 10 },
  },
  {
    slug: "ach_listings_10",
    name: "Vitrin",
    category: "achievement",
    theme: "sunset",
    needs: "achievement",
    rank: 4,
    hint: "10 ilanın yayında olsun",
    rule: { kind: "listings", min: 10 },
  },
  {
    slug: "ach_fast_20",
    name: "Hızlı Satıcı",
    category: "achievement",
    theme: "cyan",
    needs: "achievement",
    rank: 5,
    hint: "Ortalama 20 dakikanın altında yanıt ver",
    rule: { kind: "response", max: 20 },
  },
  {
    slug: "ach_sales_25",
    name: "25 İşlem",
    category: "achievement",
    theme: "gold-soft",
    needs: "achievement",
    rank: 6,
    hint: "25 başarılı işlem yap",
    rule: { kind: "sales", min: 25 },
  },
  {
    slug: "ach_reviews_30_45",
    name: "4.5 Yıldız",
    category: "achievement",
    theme: "gold-soft",
    needs: "achievement",
    rank: 7,
    hint: "30 değerlendirme al ve 4.5+ ortalama tuttur",
    rule: { kind: "rating", min: 4.5, reviews: 30 },
  },
  {
    slug: "ach_sales_50",
    name: "50 İşlem",
    category: "achievement",
    theme: "emerald",
    needs: "achievement",
    rank: 8,
    hint: "50 başarılı işlem yap",
    rule: { kind: "sales", min: 50 },
  },
  {
    slug: "ach_views_1000",
    name: "Gözde",
    category: "achievement",
    theme: "ice",
    needs: "achievement",
    rank: 8,
    hint: "İlanların toplam 1000 görüntülensin",
    rule: { kind: "views", min: 1000 },
  },
  {
    slug: "ach_fast_5",
    name: "Şimşek Satıcı",
    category: "achievement",
    theme: "ice",
    needs: "achievement",
    rank: 9,
    hint: "Ortalama 5 dakikanın altında yanıt ver",
    rule: { kind: "response", max: 5 },
  },
  {
    slug: "ach_favorites_100",
    name: "Favori",
    category: "achievement",
    theme: "magenta",
    needs: "achievement",
    rank: 9,
    hint: "İlanların 100 kez favorilensin",
    rule: { kind: "favorites", min: 100 },
  },
  {
    slug: "ach_rating_50",
    name: "Tam Puan",
    category: "achievement",
    theme: "magenta",
    needs: "achievement",
    rank: 10,
    hint: "20 değerlendirmede 5.0 ortalama tuttur",
    rule: { kind: "rating", min: 4.95, reviews: 20 },
  },
  {
    slug: "ach_sales_100",
    name: "100 İşlem",
    category: "achievement",
    theme: "royal",
    needs: "achievement",
    rank: 11,
    hint: "100 başarılı işlem yap",
    rule: { kind: "sales", min: 100 },
  },
  {
    slug: "ach_reviews_100",
    name: "100 Değerlendirme",
    category: "achievement",
    theme: "royal",
    needs: "achievement",
    rank: 11,
    hint: "100 değerlendirme al",
    rule: { kind: "reviews", min: 100 },
  },
];

export type FrameStats = {
  reviews: number;
  rating: number;
  sales: number;
  responseMinutes: number | null;
  memberDays: number;
  listings: number;
  views: number;
  favorites: number;
};

export const emptyFrameStats: FrameStats = {
  reviews: 0,
  rating: 0,
  sales: 0,
  responseMinutes: null,
  memberDays: 0,
  listings: 0,
  views: 0,
  favorites: 0,
};

export function findFrame(slug: string | null | undefined) {
  return frames.find((frame) => frame.slug === slug) ?? frames[0];
}

export function frameTone(slug: string | null | undefined) {
  return findFrame(slug).theme;
}

/** Başarı çerçevesi açık mı? */
export function isFrameUnlocked(frame: Frame, stats: FrameStats) {
  if (frame.category === "tag") return frame.needs === "member";
  const rule = frame.rule;
  if (!rule) return false;

  switch (rule.kind) {
    case "reviews":
      return stats.reviews >= rule.min;
    case "rating":
      return stats.reviews >= rule.reviews && stats.rating >= rule.min;
    case "sales":
      return stats.sales >= rule.min;
    case "response":
      return stats.responseMinutes !== null && stats.responseMinutes > 0 && stats.responseMinutes <= rule.max;
    case "member_days":
      return stats.memberDays >= rule.min;
    case "listings":
      return stats.listings >= rule.min;
    case "views":
      return stats.views >= rule.min;
    case "favorites":
      return stats.favorites >= rule.min;
    default:
      return false;
  }
}

/** Kilitli çerçevede "18 / 30 değerlendirme" gibi ilerleme metni */
export function frameProgress(frame: Frame, stats: FrameStats): string | null {
  const rule = frame.rule;
  if (!rule) return null;

  switch (rule.kind) {
    case "reviews":
      return `${Math.min(stats.reviews, rule.min)} / ${rule.min} değerlendirme`;
    case "rating":
      return stats.reviews < rule.reviews
        ? `${stats.reviews} / ${rule.reviews} değerlendirme`
        : `puan ${stats.rating.toFixed(1)} / ${rule.min}`;
    case "sales":
      return `${Math.min(stats.sales, rule.min)} / ${rule.min} işlem`;
    case "response":
      return stats.responseMinutes === null
        ? "yanıt süresi henüz yok"
        : `ortalama ${Math.round(stats.responseMinutes)} dk / hedef ${rule.max} dk`;
    case "member_days":
      return `${Math.min(stats.memberDays, rule.min)} / ${rule.min} gün`;
    case "listings":
      return `${Math.min(stats.listings, rule.min)} / ${rule.min} ilan`;
    case "views":
      return `${Math.min(stats.views, rule.min)} / ${rule.min} görüntülenme`;
    case "favorites":
      return `${Math.min(stats.favorites, rule.min)} / ${rule.min} favori`;
    default:
      return null;
  }
}

export const tagFrames = frames
  .filter((frame) => frame.category === "tag")
  .sort((a, b) => b.rank - a.rank);

export const achievementFrames = frames
  .filter((frame) => frame.category === "achievement")
  .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "tr"));

/** Kullanıcının sahip olduğu tag/rol çerçeveleri */
export function ownedFrames(input: {
  tags?: string[] | null;
  staffTag?: string | null;
  frames?: string[] | null;
}) {
  const set = new Set<string>(["member"]);
  for (const tag of input.tags ?? []) set.add(tag);
  for (const frame of input.frames ?? []) set.add(frame);
  if (input.staffTag) set.add(input.staffTag);
  return set;
}
