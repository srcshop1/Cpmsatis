"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Hesabı silme: şifre + şifre tekrarı doğruysa hesap kalıcı olarak silinir */
export function DeleteAccountDialog({
  open,
  email,
  onClose,
  onDeleted,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const supabase = getSupabaseBrowserClient();
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFirst("");
      setSecond("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleDelete() {
    if (busy) return;
    setError(null);

    if (!first) {
      setError("Şifreni yazman gerekiyor.");
      return;
    }
    if (first !== second) {
      setError("İki şifre aynı değil.");
      return;
    }
    if (!supabase) {
      setError("Bağlantı kurulamadı, sayfayı yenile.");
      return;
    }

    setBusy(true);
    const check = await supabase.auth.signInWithPassword({ email, password: first });
    if (check.error) {
      setBusy(false);
      setError("Şifre yanlış.");
      return;
    }

    const { error: deleteError } = await supabase.rpc("delete_my_account");
    if (deleteError) {
      setBusy(false);
      setError(
        /could not find the function|schema cache/i.test(deleteError.message)
          ? "Hesap silme şu an kapalı, birazdan tekrar dene."
          : "Hesap silinemedi, tekrar dene.",
      );
      return;
    }

    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Kapat"
      />

      <div className="animate-pop relative w-full max-w-sm rounded-2xl border border-danger/30 bg-surface p-5">
        <h2 className="text-base font-bold">Hesabı sil</h2>
        <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-2">
          Onaylarsan hesabınla birlikte ilanların, mesajların ve değerlendirmelerin silinir. Bu işlem
          geri alınamaz.
        </p>

        <label className="mt-3 block text-[0.7rem] font-semibold text-muted">Şifren</label>
        <input
          className="field mt-1 h-10 text-[0.8rem]"
          type="password"
          autoComplete="current-password"
          value={first}
          onChange={(event) => setFirst(event.target.value)}
          placeholder="Şifreni yaz"
        />

        <label className="mt-2 block text-[0.7rem] font-semibold text-muted">Şifreni tekrar yaz</label>
        <input
          className="field mt-1 h-10 text-[0.8rem]"
          type="password"
          autoComplete="current-password"
          value={second}
          onChange={(event) => setSecond(event.target.value)}
          placeholder="Şifreni bir daha yaz"
        />

        {error && <p className="mt-2 text-[0.7rem] text-[#ffb3bb]">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost h-10 flex-1 text-sm">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="btn h-10 flex-1 bg-danger/90 text-sm font-semibold text-white transition hover:bg-danger disabled:opacity-60"
          >
            {busy ? <Spinner /> : "Hesabımı sil"}
          </button>
        </div>
      </div>
    </div>
  );
}
