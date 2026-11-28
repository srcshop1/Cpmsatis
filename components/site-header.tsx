"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { BellIcon, HeartIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { SideMenu } from "@/components/side-menu";
import { AnnouncementBar } from "@/components/announcement-bar";
import { FramedAvatar, StaffBadge, VerifiedTick } from "@/components/user-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { NOTIFICATION_EVENT } from "@/lib/social";

export function SiteHeader() {
  const { user, loading } = useAuth();
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

    const onEvent = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener(NOTIFICATION_EVENT, onEvent);
    window.addEventListener("focus", onEvent);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(NOTIFICATION_EVENT, onEvent);
      window.removeEventListener("focus", onEvent);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, user]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-line-soft/80 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
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

        <div className="ml-auto flex min-w-0 items-center gap-2">
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
                href="/favoriler"
                className="hidden h-9 w-9 place-items-center rounded-xl border border-line bg-white/3 text-[#ff9ba5] transition hover:text-text sm:grid"
                aria-label="Favorilerim"
                title="Favorilerim"
              >
                <HeartIcon width={17} height={17} />
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
                className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-white/3 py-1.5 pl-1.5 pr-2 transition hover:border-[#34405a] sm:pr-3"
              >
                <FramedAvatar
                  src={user.avatarUrl}
                  username={user.username}
                  frame={user.frame}
                  size={28}
                  rounded="rounded-lg"
                />
                <span className="hidden max-w-[8rem] truncate text-sm font-semibold sm:block">
                  {user.username}
                </span>
                {user.verifiedSeller && <VerifiedTick size={13} />}
                {user.staffTag && (
                  <span className="hidden sm:inline-flex">
                    <StaffBadge tag={user.staffTag} small />
                  </span>
                )}
              </Link>

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

          <SideMenu />
        </div>
      </div>
    </header>
    <AnnouncementBar />
    </>
  );
}
