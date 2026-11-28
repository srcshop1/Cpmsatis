export type BadgeDef = { key: string; label: string; hint?: string };

/** Panelden verilebilen hazır rozetler */
export const BADGES: BadgeDef[] = [
  { key: "verified_seller", label: "Onaylı Satıcı" },
  { key: "vip", label: "VIP" },
  { key: "premium", label: "Premium" },
  { key: "trusted", label: "Güvenilir" },
  { key: "fast", label: "Hızlı Teslimat" },
  { key: "support", label: "Destekçi" },
];

export function badgeLabel(key: string) {
  return BADGES.find((badge) => badge.key === key)?.label ?? key;
}

/** Rozet sıralaması: VIP, Premium'dan üstündür */
const TAG_RANK: Record<string, number> = { vip: 5, premium: 4, verified_seller: 3, trusted: 2, fast: 1, support: 1 };

export function sortTags(tags: string[]) {
  return [...tags].sort((a, b) => (TAG_RANK[b] ?? 0) - (TAG_RANK[a] ?? 0));
}
