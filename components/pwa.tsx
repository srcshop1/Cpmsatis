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

/** Uygulama zaten yüklüyse (ana ekrandan açılmışsa) true */
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const AUTO_KEY = "cpm-install-auto";
const AUTO_COOLDOWN = 2 * 24 * 60 * 60 * 1000; // 2 günde bir dener

/** Kurulum penceresini ilk dokunuşta kendiliğinden açar. */
function armAutoInstall() {
  if (typeof window === "undefined" || !deferredPrompt) return;
  try {
    const last = Number(window.localStorage.getItem(AUTO_KEY) || 0);
    if (last && Date.now() - last < AUTO_COOLDOWN) return;
    window.localStorage.setItem(AUTO_KEY, String(Date.now()));
  } catch {
    // localStorage kapalıysa yine de dene
  }

  const fire = async () => {
    document.removeEventListener("pointerdown", fire);
    document.removeEventListener("keydown", fire);
    const prompt = deferredPrompt;
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // yoksay
    }
    deferredPrompt = null;
    promptListeners.forEach((listener) => listener());
  };

  document.addEventListener("pointerdown", fire, { passive: true });
  document.addEventListener("keydown", fire);
}

/** Site açılınca kurulum iznini yakalar ve ilk dokunuşta kendiliğinden sorar. */
export function PwaSetup() {
  useServiceWorker();

  useEffect(() => {
    if (isStandalone()) return;
    const ready = () => {
      if (deferredPrompt) armAutoInstall();
    };
    ready();
    promptListeners.add(ready);
    window.addEventListener("appinstalled", onInstalledOnce);
    return () => {
      promptListeners.delete(ready);
      window.removeEventListener("appinstalled", onInstalledOnce);
    };
  }, []);

  return null;
}

function onInstalledOnce() {
  deferredPrompt = null;
}

/**
 * Profildeki "Uygulamayı Yükle" butonu.
 * Kurulum penceresi gelmiyorsa (Safari, masaüstü) nasıl yükleneceğini söyler.
 */
let deferredPrompt: InstallPrompt | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPrompt;
    promptListeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    promptListeners.forEach((listener) => listener());
  });
}

export function InstallAppButton() {
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const listener = () => setReady(Boolean(deferredPrompt));
    promptListeners.add(listener);
    setReady(Boolean(deferredPrompt));

    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      promptListeners.delete(listener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setNote(null);
          if (!deferredPrompt) {
            const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
            setNote(
              isIos
                ? "Safari'de alttaki Paylaş simgesine bas, sonra “Ana Ekrana Ekle”yi seç."
                : "Tarayıcı menüsünü aç, “Uygulamayı yükle” veya “Ana ekrana ekle”yi seç.",
            );
            return;
          }
          try {
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice;
          } catch {
            // yoksay
          }
          deferredPrompt = null;
          setReady(false);
        }}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 text-[0.72rem] font-semibold text-accent transition hover:bg-accent/15"
      >
        <PlusIcon width={12} height={12} /> Uygulamayı Yükle
        {ready ? <span className="text-[0.6rem] text-accent/70">hazır</span> : null}
      </button>
      {note && (
        <p className="mt-1.5 rounded-lg border border-line bg-white/4 px-2.5 py-2 text-[0.64rem] leading-relaxed text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
