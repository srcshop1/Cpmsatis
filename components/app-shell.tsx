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
      <main className="mx-auto w-full max-w-6xl px-4 py-5">{children}</main>
      <div className="mx-auto w-full max-w-6xl px-4">
        <Disclaimer variant="compact" />
      </div>
      <BottomNav />
    </div>
  );
}
