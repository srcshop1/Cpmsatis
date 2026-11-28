"use client";

import type { CSSProperties, ReactNode } from "react";
import { findFrame } from "@/lib/frames";

/** Tema başına halka kalınlığı, dönüş hızı ve ışık efekti */
const THEMES: Record<string, { ring: number; speed: string; shine: string; shineOn: boolean }> = {
  rainbow: { ring: 3, speed: "3.2s", shine: "4.2s", shineOn: true },
  blue: { ring: 2.5, speed: "4.4s", shine: "5.2s", shineOn: true },
  gold: { ring: 2.5, speed: "4.6s", shine: "4.8s", shineOn: true },
  violet: { ring: 2.4, speed: "6.2s", shine: "6.4s", shineOn: true },
  mint: { ring: 2.2, speed: "5.6s", shine: "6.6s", shineOn: true },
  royal: { ring: 2.4, speed: "4.8s", shine: "5s", shineOn: true },
  emerald: { ring: 2.2, speed: "5.4s", shine: "6s", shineOn: true },
  ice: { ring: 2.2, speed: "5s", shine: "5.4s", shineOn: true },
  cyan: { ring: 2.2, speed: "5.2s", shine: "5.8s", shineOn: true },
  magenta: { ring: 2.2, speed: "5.6s", shine: "6.2s", shineOn: true },
  sunset: { ring: 2.2, speed: "5.8s", shine: "6.4s", shineOn: true },
  "gold-soft": { ring: 2.2, speed: "6s", shine: "6.8s", shineOn: true },
  silver: { ring: 2, speed: "6.4s", shine: "7s", shineOn: true },
  bronze: { ring: 2, speed: "6.8s", shine: "7.4s", shineOn: true },
  plain: { ring: 1.5, speed: "0s", shine: "0s", shineOn: false },
};

/**
 * Avatarın etrafına holografik, hareketli çerçeve koyar.
 * Üye çerçevesi sade kalır; kurucu en parlak ve en hızlısıdır.
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
  const def = findFrame(frame);
  const theme = THEMES[def.theme] ?? THEMES.plain;
  // Küçük avatarlarda çerçeve incelsin ki resim kaybolmasın
  const ring = Math.min(theme.ring, Math.max(1.5, size * 0.085));
  const inner = Math.max(0, size - ring * 2);

  return (
    <span
      className={`frame-ring frame-ring--${def.theme} shrink-0 ${rounded}`}
      style={{ height: size, width: size }}
    >
      <span
        className="frame-ring__gradient"
        style={{ animationDuration: theme.speed } as CSSProperties}
      />
      {theme.shineOn && def.theme !== "plain" && (
        <span
          className="frame-ring__shine"
          style={{ animationDuration: theme.shine } as CSSProperties}
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
