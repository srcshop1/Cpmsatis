"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";

/** Askı süresi dolduğunda ekranı kendiliğinden açar. */
function useActiveBan() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user?.banned) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [user?.banned]);

  if (!user?.banned) return null;

  const until = user.bannedUntil ? new Date(user.bannedUntil).getTime() : null;
  if (until !== null && until <= now) return null;

  return { user, until };
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Askıya alınmış hesap için tam ekran engel.
 * İlanlar dahil hiçbir sayfa görüntülenemez.
 */
export function BanGate({ children }: { children: ReactNode }) {
  const ban = useActiveBan();
  const { signOut, refreshUser } = useAuth();

  // Süre bittiğinde oturum bilgisini tazele
  useEffect(() => {
    if (!ban) return;
    if (ban.until === null) return;
    const ms = ban.until - Date.now();
    if (ms <= 0) {
      void refreshUser();
      return;
    }
    const timer = window.setTimeout(() => void refreshUser(), Math.min(ms + 1500, 2147483000));
    return () => window.clearTimeout(timer);
  }, [ban, refreshUser]);

  if (!ban) return <>{children}</>;

  const { user, until } = ban;
  const daysLeft = until ? Math.max(1, Math.ceil((until - Date.now()) / 86400000)) : null;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-aurora px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-danger/35 bg-[#150b10]/90 p-6 text-center shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-danger/40 bg-danger/12">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-[#ff9aa5]"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M5.7 5.7l12.6 12.6" />
          </svg>
        </div>

        <h1 className="mt-4 text-lg font-extrabold text-[#ffe4e8]">Hesabınız askıda</h1>
        <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">
          Askı kalkana kadar ilanları görüntüleyemez, ilan açamaz ve mesaj gönderemezsin.
        </p>

        <dl className="mt-5 space-y-2.5 rounded-xl border border-line bg-white/3 p-3.5 text-left">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[0.72rem] text-muted-2">Süre</dt>
            <dd className="text-right text-[0.78rem] font-semibold text-[#ffe4e8]">
              {until ? (
                <>
                  {formatDate(until)} tarihine kadar
                  <span className="block text-[0.7rem] font-normal text-muted">
                    {daysLeft} gün kaldı
                  </span>
                </>
              ) : (
                "Süresiz"
              )}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="text-[0.72rem] text-muted-2">Sebep</dt>
            <dd className="max-w-[62%] text-right text-[0.78rem] font-semibold text-[#ffe4e8]">
              {user.banReason ? user.banReason : "Belirtilmedi"}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="text-[0.72rem] text-muted-2">Askıya alan</dt>
            <dd className="text-right text-[0.78rem] font-semibold text-[#ffe4e8]">
              {user.banAuthorUsername ? `@${user.banAuthorUsername}` : "Yetkili"}
              <span className="block text-[0.7rem] font-normal text-muted">yetkili</span>
            </dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="text-[0.72rem] text-muted-2">Hesap</dt>
            <dd className="text-right text-[0.78rem] font-semibold text-[#ffe4e8]">
              @{user.username}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-[0.7rem] leading-relaxed text-muted-2">
          {until
            ? "Süre dolduğunda hesabın kendiliğinden açılır; sayfayı yenilemen yeterli."
            : "Askıyı kaldırmak için bir yetkiliyle iletişime geçmen gerekiyor."}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={() => void refreshUser()} className="btn h-11 w-full text-sm">
            Durumu yenile
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn btn-ghost h-11 w-full text-sm"
          >
            Çıkış yap
          </button>
        </div>

        <a
          href={`${base}/`}
          className="mt-4 inline-block text-[0.7rem] text-muted-2 underline underline-offset-2"
        >
          CPM Satış
        </a>
      </div>
    </div>
  );
}
