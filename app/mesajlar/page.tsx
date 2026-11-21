"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { MessageIcon, PlusIcon } from "@/components/icons";

export default function MessagesPage() {
  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Mesajlar</h1>
          <p className="mt-1 text-xs text-muted-2 sm:text-sm">Satıcı ve alıcı sohbetlerin</p>
        </div>
        <button
          type="button"
          disabled
          className="btn btn-ghost h-9 cursor-not-allowed px-3 text-xs opacity-60"
          title="Sohbet başlatma yakında"
        >
          <PlusIcon width={15} height={15} /> Yeni sohbet
        </button>
      </div>

      <div className="mt-5 card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/4 text-accent">
          <MessageIcon width={28} height={28} />
        </span>
        <div>
          <h2 className="text-base font-bold">Henüz mesajın yok</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-2">
            Bir ilanın altındaki <span className="text-muted">Satıcı ile İletişime Geç</span>{" "}
            butonuna bastığında sohbet burada açılır.
          </p>
        </div>
        <Link href="/ilanlar" className="btn btn-primary h-10 px-5 text-sm">
          İlanlara göz at
        </Link>
      </div>

      <p className="mt-5 text-center text-[0.68rem] text-muted-2">
        Sohbetler, engelleme ve bildirme bir sonraki güncellemede aktif olacak.
      </p>
    </AppShell>
  );
}
