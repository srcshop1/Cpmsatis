"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { CheckIcon, ChevronLeftIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function VerifiedSellerApplyPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deals = user?.salesCount ?? 0;
  const reviews = 0;
  const rating = user?.rating ?? 0;
  const allMet = deals >= 30 && reviews >= 30 && reviews > 0 && rating >= 4;

  async function submit() {
    if (!accepted || !allMet || !supabase || !user) return;

    setError(null);
    const { error: insertError } = await supabase.from("seller_applications").insert({
      user_id: user.id,
    });

    if (insertError) {
      setError(`Başvuru gönderilemedi: ${insertError.message}`);
      return;
    }
    setSubmitted(true);
  }

  return (
    <AppShell>
      <Link
        href="/diger/onayli-satici"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> Gereksinimler
      </Link>

      <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
        Onaylı Satıcı Başvurusu
      </h1>

      {submitted ? (
        <div className="mt-5 card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-mint/30 bg-mint/10 text-mint">
            <CheckIcon width={26} height={26} />
          </span>
          <h2 className="text-base font-bold">Başvurun alındı</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-2">
            Yetkili ekibimiz mağazanı inceleyecek. Sonuç bildirimlerine düşecek.
          </p>
          <Link href="/diger" className="btn btn-ghost h-10 px-4 text-sm">
            Diğer&apos;e dön
          </Link>
        </div>
      ) : (
        <div className="mt-5 card p-5">
          {!allMet && (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs leading-relaxed text-[#ffb3bb]">
              Gereksinimlerin tamamını karşılamıyorsun. Başvuru şu an gönderilemez.
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-soft bg-white/3 p-3.5">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff8a1f]"
            />
            <span className="text-[0.82rem] leading-relaxed text-muted">
              Onaylı Satıcı olmak istiyorum; yukarıdaki bilgilerin doğru olduğunu ve mağazamın
              yetkili tarafından incelenmesini kabul ediyorum.
            </span>
          </label>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!accepted || !allMet}
            className="btn btn-primary mt-4 h-12 w-full disabled:cursor-not-allowed disabled:opacity-45"
          >
            Başvuru Yap
          </button>
          <p className="mt-2 text-center text-[0.68rem] text-muted-2">
            Başvurular yetkili paneline düşer, sonuç bildirim olarak gelir.
          </p>
        </div>
      )}
    </AppShell>
  );
}
