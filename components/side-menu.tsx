"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

const LINKS: { href: string; label: string }[] = [
  { href: "/ilanlar", label: "İlanlar" },
  { href: "/mesajlar", label: "Mesajlar" },
  { href: "/siparisler", label: "Siparişler" },
  { href: "/favoriler", label: "Favorilerim" },
  { href: "/bildirimler", label: "Bildirimler" },
  { href: "/profil", label: "Profil" },
  { href: "/diger", label: "Diğer" },
  { href: "/diger/sss", label: "Sık sorulan sorular" },
  { href: "/diger/destek", label: "Destek" },
];

/**
 * Üç çizgi → X dönüşen hamburger + sağdan kayan menü.
 * Satırlar panel açıldıktan sonra sırayla belirir, kapanırken ters sırayla toplanır.
 */
export function SideMenu() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Kapanma animasyonu bitsin diye panel DOM'da kalır
  const [mounted, setMounted] = useState(false);
  const timer = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const links = [
    ...LINKS,
    ...(user ? [{ href: "/ilan/olustur", label: "İlan oluştur" }] : []),
    ...(user && (user.staffTag === "owner" || user.staffTag === "moderator")
      ? [{ href: "/yetkili", label: "Yetkili paneli" }]
      : []),
  ];

  useEffect(() => {
    if (open) {
      setMounted(true);
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    if (mounted) {
      timer.current = window.setTimeout(() => setMounted(false), 380);
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Sayfa değişince menüyü kapat
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white/3 text-text transition hover:border-accent/40 lg:hidden"
      >
        <span className="relative block h-4 w-5" aria-hidden>
          <span
            className="absolute left-0 top-0 block h-[2px] w-5 rounded-full bg-current transition-transform duration-300 ease-in-out"
            style={{ transform: open ? "translateY(7px) rotate(45deg)" : "none" }}
          />
          <span
            className="absolute left-0 top-[7px] block h-[2px] w-5 rounded-full bg-current transition-opacity duration-300 ease-in-out"
            style={{ opacity: open ? 0 : 1 }}
          />
          <span
            className="absolute left-0 top-[14px] block h-[2px] w-5 rounded-full bg-current transition-transform duration-300 ease-in-out"
            style={{ transform: open ? "translateY(-7px) rotate(-45deg)" : "none" }}
          />
        </span>
      </button>

      {mounted && (
        <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true">
          {/* Kararan arka plan */}
          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black transition-opacity duration-350"
            style={{ opacity: open ? 0.5 : 0 }}
          />

          {/* Sağdan kayan panel */}
          <nav
            id="site-menu"
            className="absolute right-0 top-0 flex h-full w-[84%] max-w-sm flex-col border-l border-white/10 bg-ink/90 px-5 pb-8 pt-5 shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.9)]"
            style={{
              transform: open ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.35s cubic-bezier(.2,.8,.2,1)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-2">
                Menü
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-line bg-white/4 px-2.5 py-1 text-[0.66rem] font-semibold text-muted"
              >
                Kapat
              </button>
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
              {links.map((item, index) => {
                const active = pathname === item.href;
                const delay = open
                  ? 80 + index * 45
                  : Math.max(0, (links.length - index) * 25);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-xl px-3 py-2.5 text-[0.9rem] font-semibold transition-colors ${
                      active
                        ? "bg-accent/12 text-accent"
                        : "text-text/90 hover:bg-white/5 hover:text-text"
                    }`}
                    style={{
                      opacity: open ? 1 : 0,
                      transform: open ? "translateX(0)" : "translateX(20px)",
                      transition: open
                        ? `opacity 0.28s ease ${delay}ms, transform 0.32s cubic-bezier(.2,.8,.2,1) ${delay}ms`
                        : `opacity 0.18s ease ${delay}ms, transform 0.2s ease ${delay}ms`,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {!user && (
              <div className="mt-4 grid gap-2">
                <Link href="/giris" className="btn btn-ghost h-10 text-sm" onClick={() => setOpen(false)}>
                  Giriş yap
                </Link>
                <Link href="/kayit" className="btn btn-primary h-10 text-sm" onClick={() => setOpen(false)}>
                  Kayıt ol
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
