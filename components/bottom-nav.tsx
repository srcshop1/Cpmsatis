"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { GridIcon, MenuIcon, MessageIcon, PlusIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UNREAD_EVENT, loadUnreadMessages } from "@/lib/social";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { width?: number; height?: number; className?: string }) => React.ReactNode;
};

const items: NavItem[] = [
  { href: "/ilanlar", label: "İlanlar", icon: (props) => <GridIcon {...props} /> },
  { href: "/diger", label: "Diğer", icon: (props) => <MenuIcon {...props} /> },
  { href: "/mesajlar", label: "Mesajlar", icon: (props) => <MessageIcon {...props} /> },
  { href: "/profil", label: "Profil", icon: (props) => <UserAvatarIcon /> },
];

function UserAvatarIcon() {
  return (
    <svg width={21} height={21} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8.6" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.8 20c1.3-3.2 4-4.8 7.2-4.8s5.9 1.6 7.2 4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Okunmamış DM sayısı (Mesajlar sekmesinde rozet)
  useEffect(() => {
    if (!supabase || !user) {
      setUnreadMessages(0);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { total } = await loadUnreadMessages(supabase, user.id);
      if (!cancelled) setUnreadMessages(total);
    };

    void load();
    const timer = setInterval(() => void load(), 20000);

    const onEvent = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener(UNREAD_EVENT, onEvent);
    window.addEventListener("focus", onEvent);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(UNREAD_EVENT, onEvent);
      window.removeEventListener("focus", onEvent);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, user, pathname]);

  const isActive = (href: string) =>
    href === "/ilanlar" ? pathname === "/ilanlar" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Alt gezinme"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-[#0b0e14]/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-lg items-end justify-between gap-1 px-2 pb-1.5 pt-2">
        {items.slice(0, 2).map((item) => (
          <NavButton key={item.href} item={item} active={isActive(item.href)} />
        ))}

        {/* Ortadaki İlan Oluştur */}
        <Link
          href="/ilan/olustur"
          className="group relative -mt-7 flex w-[4.6rem] flex-col items-center"
          aria-label="İlan oluştur"
        >
          <span className="grid h-[3.35rem] w-[3.35rem] place-items-center rounded-full bg-gradient-to-br from-accent-soft via-accent to-accent-deep text-ink shadow-[0_12px_26px_-10px_rgba(255,138,31,0.95)] ring-[5px] ring-[#0b0e14] transition group-active:scale-95">
            <PlusIcon width={24} height={24} strokeWidth={2.6} />
          </span>
          <span className="mt-1 text-[0.62rem] font-semibold text-accent">İlan Oluştur</span>
        </Link>

        {items.slice(2).map((item) => (
          <NavButton
            key={item.href}
            item={item}
            active={isActive(item.href)}
            badge={item.href === "/mesajlar" ? unreadMessages : 0}
          />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
  badge = 0,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={item.href}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[0.62rem] font-medium transition ${
        active ? "text-accent" : "text-muted-2 hover:text-muted"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={`relative grid place-items-center transition-transform duration-200 ${
          active ? "text-accent -translate-y-0.5" : ""
        }`}
      >
        {active && (
          <span className="absolute -inset-x-2.5 -inset-y-1 -z-10 rounded-lg bg-accent/12" />
        )}
        {item.icon({ width: 21, height: 21 })}
        {badge > 0 && (
          <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-danger px-1 text-[0.55rem] font-bold leading-none text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {active && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
        )}
      </span>
      <span className={active ? "font-semibold" : ""}>{item.label}</span>
    </Link>
  );
}
