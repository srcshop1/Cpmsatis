"use client";

import type { CSSProperties, ReactNode } from "react";
import { findFrame } from "@/lib/frames";

/** Tema başına halka kalınlığı, dönüş hızı ve ışık efekti */
const THEMES: Record<string, { ring: number; speed: string; shine: string; shineOn: boolean }> = {
  // Tag çerçeveleri: parlak, kalın, hızlı (kurucu en üstün)
  rainbow: { ring: 3.4, speed: "3s", shine: "3.8s", shineOn: true },
  blue: { ring: 3, speed: "4s", shine: "4.6s", shineOn: true },
  gold: { ring: 3, speed: "4.2s", shine: "4.4s", shineOn: true },
  violet: { ring: 2.8, speed: "5s", shine: "5.4s", shineOn: true },
  mint: { ring: 2.6, speed: "5.2s", shine: "6s", shineOn: true },
  // Başarı çerçeveleri: ince, sakin, ışıksız
  royal: { ring: 1.8, speed: "9s", shine: "0s", shineOn: false },
  emerald: { ring: 1.8, speed: "9.5s", shine: "0s", shineOn: false },
  ice: { ring: 1.8, speed: "10s", shine: "0s", shineOn: false },
  cyan: { ring: 1.8, speed: "10s", shine: "0s", shineOn: false },
  magenta: { ring: 1.8, speed: "10.5s", shine: "0s", shineOn: false },
  sunset: { ring: 1.8, speed: "11s", shine: "0s", shineOn: false },
  "gold-soft": { ring: 1.8, speed: "11s", shine: "0s", shineOn: false },
  silver: { ring: 1.7, speed: "12s", shine: "0s", shineOn: false },
  bronze: { ring: 1.7, speed: "12s", shine: "0s", shineOn: false },
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
