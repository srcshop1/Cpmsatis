"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChevronLeftIcon, ClockIcon, HeadsetIcon } from "@/components/icons";

export default function LiveSupportPage() {
  return (
    <AppShell>
      <Link
        href="/diger"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> Diğer
      </Link>

      <div className="mt-6 card flex flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
          <HeadsetIcon width={30} height={30} />
        </span>
        <div>
          <h1 className="text-lg font-bold">Canlı Destek</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-2">
            Yetkiliyle anında yazışma özelliği hazırlanıyor. Şimdilik destek talebi
            oluşturabilirsin; ekibimiz en kısa sürede döner.
          </p>
        </div>
        <span className="badge border border-line bg-white/4 text-[0.7rem] text-muted">
          <ClockIcon width={13} height={13} /> Yakında Gelecek
        </span>
        <Link href="/diger/destek" className="btn btn-primary h-10 px-5 text-sm">
          Destek Talebi Oluştur
        </Link>
      </div>
    </AppShell>
  );
}
