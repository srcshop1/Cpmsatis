"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { BottomNav } from "@/components/bottom-nav";
import { Disclaimer } from "@/components/disclaimer";
import { SiteHeader } from "@/components/site-header";

/**
 * Oturum gerektiren sayfalar için kabuk: üst menü + alt gezinme çubuğu.
 * Giriş yapılmamışsa /giris?next=... adresine yönlendirir.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/giris?next=${encodeURIComponent(pathname || "/ilanlar")}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) return <AuthPageLoading />;

  return (
    <div className="relative min-h-screen bg-aurora pb-28">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        {(() => {
          const until = user.bannedUntil ? new Date(user.bannedUntil).getTime() : null;
          const active = Boolean(user.banned) && (until === null || until > Date.now());
          if (!active) return null;
          return (
            <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[0.76rem] leading-relaxed text-[#ffb3bb]">
              <strong className="text-[#ffc9cf]">Hesabın askıda.</strong>{" "}
              {user.banReason ? `Sebep: ${user.banReason}. ` : ""}
              {until
                ? `Bitiş: ${new Date(until).toLocaleDateString("tr-TR")} (${Math.max(
                    1,
                    Math.ceil((until - Date.now()) / 86400000),
                  )} gün kaldı).`
                : "Süresiz."}{" "}
              İlan açamaz ve mesaj gönderemezsin.
            </div>
          );
        })()}
        {children}
      </main>
      <div className="mx-auto w-full max-w-6xl px-4">
        <Disclaimer variant="compact" />
      </div>
      <BottomNav />
    </div>
  );
}
