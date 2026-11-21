"use client";

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
  };
  const item = config[tag];
  if (!item) return null;

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

/** Avatarı çerçeve rengiyle saran kutu */
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
  const tone =
    {
      member: "from-[#3a4356] to-[#1b2130]",
      verified_seller: "from-[#35d49a] to-[#0f9d6e]",
      vip: "from-[#ffd166] to-[#ff8a1f]",
      premium: "from-[#c084fc] to-[#7c3aed]",
      moderator: "from-[#6c8cff] to-[#3b4fd8]",
      owner: "from-[#ff9a3c] to-[#f26a00]",
    }[frame ?? "member"] ?? "from-[#3a4356] to-[#1b2130]";

  return (
    <span
      className={`grid shrink-0 place-items-center bg-gradient-to-br ${tone} p-[2px] ${rounded}`}
      style={{ height: size, width: size }}
    >
      <span
        className={`grid h-full w-full place-items-center overflow-hidden bg-ink text-[0.7rem] font-extrabold text-text ${rounded}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          (username ?? "?").charAt(0).toUpperCase()
        )}
      </span>
    </span>
  );
}
