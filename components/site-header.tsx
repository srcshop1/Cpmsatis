"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { BellIcon, LogoutIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/logo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SiteHeader() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [unread, setUnread] = useState(0);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!supabase || !user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (!cancelled) setUnread(count ?? 0);
    };
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [supabase, user]);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    setPending(false);
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft/80 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Logo />

        <nav className="ml-3 hidden items-center gap-0.5 lg:flex" aria-label="Ana menü">
          {[
            { href: "/ilanlar", label: "İlanlar" },
            { href: "/diger", label: "Diğer" },
            { href: "/mesajlar", label: "Mesajlar" },
            { href: "/siparisler", label: "Siparişler" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/ilanlar"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/3 text-muted transition hover:text-text lg:hidden"
            aria-label="İlanlarda ara"
          >
            <SearchIcon width={17} height={17} />
          </Link>

          {loading ? (
            <span
              className="h-9 w-24 animate-pulse rounded-xl border border-line bg-white/4"
              aria-hidden
            />
          ) : user ? (
            <>
              <Link
                href="/ilan/olustur"
                className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent-soft to-accent-deep px-3.5 py-2 text-sm font-bold text-ink transition hover:brightness-105 sm:flex"
              >
                <PlusIcon width={16} height={16} strokeWidth={2.6} /> İlan Oluştur
              </Link>

              <Link
                href="/bildirimler"
                className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/3 text-muted transition hover:text-text"
                aria-label="Bildirimler"
              >
                <BellIcon width={17} height={17} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.55rem] font-bold text-ink">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              <Link
                href="/profil"
                className="flex items-center gap-2 rounded-xl border border-line bg-white/3 py-1.5 pl-1.5 pr-3 transition hover:border-[#34405a]"
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-soft to-accent-deep text-[0.8rem] font-bold text-ink">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="hidden max-w-[8rem] truncate text-sm font-semibold sm:block">
                  {user.username}
                </span>
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
    </header>
  );
}
