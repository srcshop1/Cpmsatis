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
