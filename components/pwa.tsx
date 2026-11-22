"use client";

import { useEffect, useState } from "react";
import { PlusIcon } from "@/components/icons";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice?: Promise<unknown> };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Service worker'ı kaydeder (uygulama gibi açılabilmesi için). */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {
        // yoksay: PWA olmadan site normal çalışır
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
}

/** Layout'a konur: service worker'ı kaydeder. */
export function PwaSetup() {
  useServiceWorker();
  return null;
}

/**
 * Profildeki küçük "Uygulamayı Yükle" butonu.
 * Tarayıcı yüklemeyi desteklemiyorsa hiç görünmez.
 */
export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !prompt) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await prompt.prompt();
          await prompt.userChoice;
        } catch {
          // yoksay
        }
        setPrompt(null);
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-white/4 px-2 py-1 text-[0.62rem] font-semibold text-muted transition hover:text-text"
    >
      <PlusIcon width={11} height={11} /> Uygulamayı Yükle
    </button>
  );
}
