"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  HeadsetIcon,
  MessageIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";

const menuItems = [
  {
    href: "/diger/sss",
    title: "SSS",
    description: "Sıkça sorulan 15 soru ve cevabı",
    icon: <MessageIcon width={19} height={19} />,
    badge: null,
  },
  {
    href: "/diger/destek",
    title: "Destek Talebi",
    description: "Sorununu ilet, destek ekibi incelesin",
    icon: <HeadsetIcon width={19} height={19} />,
    badge: null,
  },
  {
    href: "/diger/onayli-satici",
    title: "Onaylı Satıcı Başvurusu",
    description: "Gereksinimleri gör, başvurunu yap",
    icon: <ShieldIcon width={19} height={19} />,
    badge: null,
  },
  {
    href: "/diger/canli-destek",
    title: "Canlı Destek",
    description: "Yetkiliyle anında yazışma",
    icon: <UsersIcon width={19} height={19} />,
    badge: "Yakında Gelecek",
  },
];

export default function MorePage() {
  const { user } = useAuth();
  const isStaff = false; // roller tablosu bağlandığında aktif olacak

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Diğer</h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">
        Yardım, başvurular ve hesap işlemleri
      </p>

      <div className="mt-5 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card card-hover flex items-center gap-3 p-3.5"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-black/25 text-accent">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{item.title}</span>
                {item.badge && (
                  <span className="badge border border-line bg-white/5 text-[0.6rem] text-muted-2">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[0.72rem] text-muted-2">
                {item.description}
              </span>
            </span>
            <ChevronRightIcon width={16} height={16} className="shrink-0 text-muted-2" />
          </Link>
        ))}

        {isStaff && (
          <Link
            href="/yetkili"
            className="card card-hover flex items-center gap-3 border-accent/30 p-3.5"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/40 bg-accent/12 text-accent">
              <ShieldIcon width={19} height={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Yetkili Panelleri</span>
              <span className="mt-0.5 block text-[0.72rem] text-muted-2">
                Destek, başvuru, öne çıkarma ve tag işlemleri
              </span>
            </span>
            <ArrowRightIcon width={16} height={16} className="text-accent" />
          </Link>
        )}
      </div>

      <div className="mt-6 card p-4">
        <p className="text-sm font-semibold">{user?.username}</p>
        <p className="mt-0.5 text-xs text-muted-2">{user?.email}</p>
        <Link
          href="/profil"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-soft"
        >
          Profil ayarları <ArrowRightIcon width={13} height={13} />
        </Link>
      </div>

      <p className="mt-6 text-center text-[0.68rem] text-muted-2">
        CPM Satış · Ödeme alınmaz, komisyon yok
      </p>
    </AppShell>
  );
}
