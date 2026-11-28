"use client";

import { FrameRing } from "@/components/frame-ring";
import { ShieldIcon } from "@/components/icons";

/** Mavi tik — onaylı satıcı */
export function VerifiedTick({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Onaylı Satıcı"
      role="img"
      className="shrink-0"
    >
      <path
        d="M12 2.5l2.4 1.9 3-.4 1.2 2.8 2.7 1.4-.7 2.9 1.4 2.7-2.1 2.1-.4 3-3 .2-2.2 2-2.3-1.9-3 .4-1.2-2.8L3.1 15l.7-2.9L2.4 9.4 4.5 7.3l.4-3 3-.2L12 2.5z"
        fill="#1d9bf0"
      />
      <path
        d="M8.2 12.2l2.5 2.5 5.2-5.4"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** "Onaylı Satıcı" yazılı mavi tik rozeti */
export function VerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-[#1d9bf0]/35 bg-[#1d9bf0]/12 font-semibold text-[#7cc7ff] ${
        small ? "px-1.5 py-[1px] text-[0.55rem]" : "px-2 py-0.5 text-[0.62rem]"
      }`}
      title="Onaylı Satıcı"
    >
      <VerifiedTick size={small ? 10 : 12} />
      Onaylı Satıcı
    </span>
  );
}

/** VIP / Premium gibi etiket rozetleri */
export function TagBadge({ tag, small = false }: { tag: string; small?: boolean }) {
  const config: Record<string, { label: string; className: string }> = {
    vip: { label: "VIP", className: "border-[#ffd166]/40 bg-[#ffd166]/12 text-[#ffd166]" },
    premium: {
      label: "Premium",
      className: "border-[#c084fc]/40 bg-[#c084fc]/12 text-[#d8b4fe]",
    },
    trusted: {
      label: "Güvenilir",
      className: "border-[#35d49a]/40 bg-[#35d49a]/12 text-[#8ff0c8]",
    },
    fast: {
      label: "Hızlı Teslimat",
      className: "border-[#38bdf8]/40 bg-[#38bdf8]/12 text-[#9adcff]",
    },
    support: {
      label: "Destekçi",
      className: "border-[#fb7185]/40 bg-[#fb7185]/12 text-[#ffb0ba]",
    },
  };
  const item =
    config[tag] ?? {
      // Panelden verilen özel rozetler: yazıldığı gibi gösterilir
      label: tag,
      className: "border-line bg-white/6 text-muted",
    };

  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold ${item.className} ${
        small ? "px-1.5 py-[1px] text-[0.55rem]" : "px-2 py-0.5 text-[0.62rem]"
      }`}
    >
      {item.label}
    </span>
  );
}

/** Kurucu / Moderatör rozeti (herkese görünür) */
export function StaffBadge({
  tag,
  small = false,
}: {
  tag: string | null | undefined;
  small?: boolean;
}) {
  if (!tag) return null;
  const isOwner = tag === "owner";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-semibold ${
        isOwner
          ? "border-accent/40 bg-accent/12 text-accent"
          : "border-[#6c8cff]/40 bg-[#6c8cff]/12 text-[#a9b8ff]"
      } ${small ? "px-1.5 py-[1px] text-[0.55rem]" : "px-2 py-0.5 text-[0.62rem]"}`}
      title={isOwner ? "Kurucu" : "Moderatör"}
    >
      <ShieldIcon width={small ? 10 : 12} height={small ? 10 : 12} />
      {isOwner ? "KURUCU" : "MODERATÖR"}
    </span>
  );
}

/** Avatarı holografik, hareketli çerçeveyle saran kutu */
export function FramedAvatar({
  src,
  username,
  frame,
  size = 40,
  rounded = "rounded-xl",
}: {
  src?: string | null;
  username?: string | null;
  frame?: string | null;
  size?: number;
  rounded?: string;
}) {
  return (
    <FrameRing frame={frame} size={size} rounded={rounded}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        (username ?? "?").charAt(0).toUpperCase()
      )}
    </FrameRing>
  );
}
