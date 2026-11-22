export type ListingCategory = {
  slug: string;
  name: string;
  short: string;
  icon: string;
};

/** İlan kategorileri — filtrelerde birden fazla seçilebilir. */
export const listingCategories: ListingCategory[] = [
  { slug: "cpm1", name: "Car Parking Multiplayer 1", short: "CPM 1", icon: "🚗" },
  { slug: "cpm2", name: "Car Parking Multiplayer 2", short: "CPM 2", icon: "🏎️" },
  { slug: "takas", name: "Takas", short: "Takas", icon: "🔄" },
  { slug: "satilik", name: "Satılık", short: "Satılık", icon: "🏷️" },
  { slug: "cizim", name: "Çizim", short: "Çizim", icon: "🎨" },
  { slug: "krom", name: "Krom", short: "Krom", icon: "✨" },
];

export function findCategory(slug: string) {
  return listingCategories.find((category) => category.slug === slug);
}

export const MAX_LISTING_PRICE = 50_000_000;
export const MAX_LISTING_IMAGES = 6;
export const MAX_LISTING_TITLE = 72;

/** Sadece sayı (para ikonu ile birlikte gösterilir) */
export function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}

/** Düz metin içinde kullanılacak fiyat (örn. mesaj gövdesi) */
export function formatPriceLabel(value: number) {
  return `${formatPrice(value)} TL`;
}

export function formatCompactPrice(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M TL`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}B TL`;
  return `${value} TL`;
}
