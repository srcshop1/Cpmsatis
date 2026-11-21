"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BellIcon } from "@/components/icons";

export default function NotificationsPage() {
  return (
    <AppShell>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Bildirimler</h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">
        Satış onayları, mesajlar ve başvuru sonuçları
      </p>

      <div className="mt-5 card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/4 text-accent">
          <BellIcon width={28} height={28} />
        </span>
        <div>
          <h2 className="text-base font-bold">Bildirim yok</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-2">
            Satış onayı, değerlendirme isteği ve başvuru sonuçları burada görünecek.
          </p>
        </div>
        <Link href="/ilanlar" className="btn btn-primary h-10 px-5 text-sm">
          İlanlara göz at
        </Link>
      </div>
    </AppShell>
  );
}
