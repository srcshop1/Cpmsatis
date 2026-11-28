"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { ArrowRightIcon } from "@/components/icons";

export function CtaBand() {
  const { user, loading } = useAuth();

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-accent/25 bg-gradient-to-br from-accent/16 via-surface-2 to-surface p-7 text-center sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,138,31,0.18),transparent_70%)]" />
      <div className="relative">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {loading ? "Her şey elinin altında." : user ? "Her şey hazır, hadi keşfet." : "Hesabın yok mu? 30 saniyede aç."}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {user
            ? "Panelinde arama, kategoriler ve siparişlerin seni bekliyor."
            : "Kayıt olmak ücretsiz. İlanları gör, güvenle alışverişe başla."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {loading ? null : user ? (
            <Link href="/panel" className="btn btn-primary h-11 px-6">
              Panelime git <ArrowRightIcon width={16} height={16} />
            </Link>
          ) : (
            <>
              <Link href="/kayit" className="btn btn-primary h-11 px-6">
                Ücretsiz Kayıt ol
              </Link>
              <Link href="/giris" className="btn btn-ghost h-11 px-6">
                Giriş yap
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
