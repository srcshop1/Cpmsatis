export type Frame = {
  slug: string;
  name: string;
  /** Tailwind gradient sınıfları (çerçeve rengi) */
  tone: string;
  /** Bu çerçeveyi açan tag / rol */
  needs: "member" | "verified_seller" | "vip" | "premium" | "moderator" | "owner";
  hint: string;
};

export const frames: Frame[] = [
  {
    slug: "member",
    name: "Üye",
    tone: "from-[#3a4356] to-[#1b2130]",
    needs: "member",
    hint: "Herkes kullanabilir",
  },
  {
    slug: "verified_seller",
    name: "Onaylı Satıcı",
    tone: "from-[#35d49a] to-[#0f9d6e]",
    needs: "verified_seller",
    hint: "Onaylı Satıcı tag'i gerekir",
  },
  {
    slug: "vip",
    name: "VIP",
    tone: "from-[#ffd166] to-[#ff8a1f]",
    needs: "vip",
    hint: "VIP tag'i gerekir",
  },
  {
    slug: "premium",
    name: "Premium",
    tone: "from-[#c084fc] to-[#7c3aed]",
    needs: "premium",
    hint: "Premium tag'i gerekir",
  },
  {
    slug: "moderator",
    name: "Moderatör",
    tone: "from-[#6c8cff] to-[#3b4fd8]",
    needs: "moderator",
    hint: "Moderatör yetkisi gerekir",
  },
  {
    slug: "owner",
    name: "Kurucu",
    tone: "from-[#ff9a3c] to-[#f26a00]",
    needs: "owner",
    hint: "Kurucu yetkisi gerekir",
  },
];

export function findFrame(slug: string | null | undefined) {
  return frames.find((frame) => frame.slug === slug) ?? frames[0];
}

export function frameTone(slug: string | null | undefined) {
  return findFrame(slug).tone;
}

/** Kullanıcının sahip olduğu çerçeveleri hesaplar */
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
