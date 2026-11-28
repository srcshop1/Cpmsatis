"use client";

import type { ReactNode } from "react";
import { findFrame } from "@/lib/frames";

/** Çerçeve kalınlığı ve animasyon hızı (kurucu en havalısı) */
const TIERS: Record<string, { ring: number; speed: string; shine: string; shineOn: boolean }> = {
  owner: { ring: 3, speed: "3.2s", shine: "4.2s", shineOn: true },
  moderator: { ring: 2.5, speed: "4.4s", shine: "5.4s", shineOn: true },
  vip: { ring: 2.5, speed: "5s", shine: "5.8s", shineOn: true },
  premium: { ring: 2.5, speed: "5.6s", shine: "6.2s", shineOn: true },
  verified_seller: { ring: 2, speed: "7s", shine: "8s", shineOn: false },
  member: { ring: 1.5, speed: "0s", shine: "0s", shineOn: false },
};

/**
 * Avatarın etrafına holografik, hareketli çerçeve koyar.
 * Üye çerçevesi sade kalır, kurucu en parlak ve en hızlısıdır.
 */
export function FrameRing({
  frame,
  size,
  rounded = "rounded-xl",
  children,
}: {
  frame?: string | null;
  size: number;
  rounded?: string;
  children: ReactNode;
}) {
  const slug = findFrame(frame).slug;
  const tier = TIERS[slug] ?? TIERS.member;
  // Küçük avatarlarda çerçeve incelsin ki resim kaybolmasın
  const ring = Math.min(tier.ring, Math.max(1.5, size * 0.085));
  const inner = Math.max(0, size - ring * 2);

  return (
    <span
      className={`frame-ring frame-ring--${slug} shrink-0 ${rounded}`}
      style={{ height: size, width: size }}
    >
      <span
        className="frame-ring__gradient"
        style={{ animationDuration: tier.speed } as React.CSSProperties}
      />
      {tier.shineOn && slug !== "member" && (
        <span
          className="frame-ring__shine"
          style={{ animationDuration: tier.shine } as React.CSSProperties}
        />
      )}
      <span
        className={`frame-ring__inner grid place-items-center text-[0.7rem] font-extrabold text-text ${rounded}`}
        style={{ height: inner, width: inner }}
      >
        {children}
      </span>
    </span>
  );
}
