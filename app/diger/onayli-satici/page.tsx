"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/icons";

export default function VerifiedSellerPage() {
  const { user } = useAuth();

  const deals = user?.salesCount ?? 0;
  const reviews = 0;
  const rating = user?.rating ?? 0;

  const requirements = [
    { label: "30+ Başarılı İşlem", met: deals >= 30, current: `${deals} işlem` },
    { label: "30+ Değerlendirme", met: reviews >= 30, current: `${reviews} değerlendirme` },
    {
      label: "4.0+ Değerlendirme Puanı",
      met: reviews > 0 && rating >= 4,
      current: reviews > 0 ? `${rating.toFixed(2)} / 5` : "henüz puan yok",
    },
  ];

  const allMet = requirements.every((item) => item.met);

  return (
    <AppShell>
      <Link
        href="/diger"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> Diğer
      </Link>

      <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
        Onaylı Satıcı Başvurusu
      </h1>

      <div className="mt-5 card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-2">Gereksinimler</h2>

        <ul className="mt-3 space-y-2">
          {requirements.map((item) => (
            <li
              key={item.label}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                item.met ? "border-mint/30 bg-mint/8" : "border-line-soft bg-white/3"
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  item.met ? "bg-mint/15 text-mint" : "bg-danger/12 text-danger"
                }`}
              >
                {item.met ? <CheckIcon width={14} height={14} /> : <XIcon width={14} height={14} />}
              </span>
              <span className="min-w-0 flex-1 text-[0.85rem] font-medium">{item.label}</span>
              <span className="shrink-0 text-[0.68rem] text-muted-2">{item.current}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[0.82rem] leading-relaxed text-muted">
          Bu koşulların tamamı karşılanıyorsa yetkili mağazanı incelemelidir. Yetkili onay
          verirse <span className="font-semibold text-accent">Onaylı Satıcı</span> olursun.
        </p>

        <Link
          href="/diger/onayli-satici/basvuru"
          className={`mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
            allMet
              ? "bg-gradient-to-br from-accent-soft to-accent-deep text-ink hover:brightness-105"
              : "cursor-not-allowed border border-line bg-white/4 text-muted-2"
          }`}
          aria-disabled={!allMet}
          onClick={(event) => {
            if (!allMet) event.preventDefault();
          }}
        >
          Onaylı Satıcı Başvurusu Yap
          <ChevronRightIcon width={16} height={16} />
        </Link>
        {!allMet && (
          <p className="mt-2 text-center text-[0.68rem] text-muted-2">
            Tüm gereksinimler sağlandığında buton aktif olur.
          </p>
        )}
      </div>
    </AppShell>
  );
}
