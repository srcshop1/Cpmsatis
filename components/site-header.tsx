"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { GridIcon, LogoutIcon, SearchIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { Spinner } from "@/components/ui/spinner";

export function SiteHeader() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    setPending(false);
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft/80 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Logo />

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Ana menü">
          <Link
            href="/panel"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-text"
          >
            Keşfet
          </Link>
          <Link
            href="/#kategoriler"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-text"
          >
            Kategoriler
          </Link>
          <Link
            href="/#nasil"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-text"
          >
            Nasıl çalışır?
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/panel"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/3 text-muted transition hover:text-text md:hidden"
            aria-label="Ara"
          >
            <SearchIcon width={17} height={17} />
          </Link>

          {loading ? (
            <span className="h-9 w-24 animate-pulse rounded-xl border border-line bg-white/4" aria-hidden />
          ) : user ? (
            <>
              <Link
                href="/panel"
                className="hidden items-center gap-2 rounded-xl border border-line bg-white/3 py-1.5 pl-1.5 pr-3 transition hover:border-[#34405a] sm:flex"
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-soft to-accent-deep text-[0.8rem] font-bold text-ink">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="max-w-[9rem] truncate text-sm font-semibold">
                  {user.username}
                </span>
              </Link>
              <Link href="/panel" className="btn btn-primary h-9 px-3 text-sm sm:hidden">
                Panelim
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={pending}
                className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/3 text-muted transition hover:border-danger/50 hover:text-danger disabled:opacity-60"
                aria-label="Çıkış yap"
                title="Çıkış yap"
              >
                {pending ? <Spinner /> : <LogoutIcon width={17} height={17} />}
              </button>
            </>
          ) : (
            <>
              <Link href="/giris" className="btn btn-ghost h-9 px-3.5 text-sm">
                Giriş Yap
              </Link>
              <Link href="/kayit" className="btn btn-primary h-9 px-3.5 text-sm">
                <span className="hidden sm:inline">Ücretsiz </span>Kayıt Ol
              </Link>
            </>
          )}
        </div>
      </div>

      {user && (
        <div className="border-t border-line-soft/60 md:hidden">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2">
            <Link href="/panel" className="chip chip-active">
              <GridIcon width={14} height={14} /> Keşfet
            </Link>
            <Link href="/#kategoriler" className="chip">
              Kategoriler
            </Link>
            <Link href="/#nasil" className="chip">
              Nasıl çalışır?
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
