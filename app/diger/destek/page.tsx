"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { CheckIcon, ChevronLeftIcon, HeadsetIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PROFANITY_MESSAGE, hasProfanity } from "@/lib/profanity";

export default function SupportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 5) {
      setError("Başlık en az 5 karakter olmalı.");
      return;
    }
    if (description.trim().length < 20) {
      setError("Açıklama en az 20 karakter olmalı, lütfen detay ver.");
      return;
    }
    if (hasProfanity(title) || hasProfanity(description)) {
      setError(PROFANITY_MESSAGE);
      return;
    }
    setError(null);

    if (!supabase || !user) {
      setError("Supabase bağlantısı yok.");
      return;
    }

    const { error: insertError } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
    });

    if (insertError) {
      console.error("[destek]", insertError.message);
      setError("Talebin gönderilemedi. Lütfen tekrar dene.");
      return;
    }

    setStep(3);
  }

  return (
    <AppShell>
      <Link
        href="/diger"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> Diğer
      </Link>

      <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">Destek Talebi</h1>

      {step === 1 && (
        <div className="mt-5 card p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-white/4 text-accent">
            <HeadsetIcon width={21} height={21} />
          </span>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Bir sorun mu yaşıyorsun? Başlık ve açıklama ile talebini ilet; yetkili ekibimiz
            inceleyip sana dönüş yapsın. Talebin durumunu bildirimlerinden takip edebilirsin.
          </p>
          <ul className="mt-4 space-y-2 text-xs text-muted-2">
            {[
              "İlan, mesaj veya hesap sorunlarını iletebilirsin.",
              "Acil durumlarda mümkün olduğunca detay yaz.",
              "Küfür ve spam içeren talepler işleme alınmaz.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckIcon width={14} height={14} className="mt-0.5 shrink-0 text-mint" />
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn btn-primary mt-5 h-11 w-full"
          >
            Devam Et
          </button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={submit} className="mt-5 card space-y-4 p-5" noValidate>
          {error && (
            <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-[#ffb3bb]">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="ticket-title" className="mb-1.5 block text-sm font-medium text-muted">
              Destek Talebi Başlığı
            </label>
            <input
              id="ticket-title"
              className="field"
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ör. Satış onayı gelmedi"
            />
            <p className="mt-1 text-[0.68rem] text-muted-2">{title.length}/100</p>
          </div>

          <div>
            <label
              htmlFor="ticket-description"
              className="mb-1.5 block text-sm font-medium text-muted"
            >
              Destek Talebi Açıklaması
            </label>
            <textarea
              id="ticket-description"
              className="field min-h-32 resize-y"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Sorunu, ne zaman olduğunu ve ne beklediğini yaz…"
            />
            <p className="mt-1 text-[0.68rem] text-muted-2">{description.length}/2000</p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost h-11 flex-1">
              Geri
            </button>
            <button type="submit" className="btn btn-primary h-11 flex-[2]">
              Destek Talebini Gönder
            </button>
          </div>

          <p className="text-[0.65rem] leading-relaxed text-muted-2">
            Talebin yetkili paneline düşer; durumunu bildirimlerinden takip edebilirsin.
          </p>
        </form>
      )}

      {step === 3 && (
        <div className="mt-5 card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-mint/30 bg-mint/10 text-mint">
            <CheckIcon width={26} height={26} />
          </span>
          <h2 className="text-base font-bold">Talebin alındı</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-2">
            Yetkili ekibimiz talebini inceleyecek. Sonucu bildirimlerinden takip edebilirsin.
          </p>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => router.push("/diger")} className="btn btn-ghost h-10 px-4 text-sm">
              Diğer&apos;e dön
            </button>
            <Link href="/ilanlar" className="btn btn-primary h-10 px-4 text-sm">
              İlanlara göz at
            </Link>
          </div>
        </div>
      )}
    </AppShell>
  );
}
