"use client";

import { useEffect, useState } from "react";

/** Askıya alma süresi seçimi: kalıcı veya gün sayısı */
export function BanDialog({
  open,
  username,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  username: string | null;
  busy?: boolean;
  onConfirm: (days: number | null, reason: string | null) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"temporary" | "permanent">("temporary");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setMode("temporary");
      setDays("7");
      setReason("");
    }
  }, [open]);

  if (!open) return null;

  const numeric = Number(days);
  const invalid = mode === "temporary" && (!days || Number.isNaN(numeric) || numeric < 1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Kapat"
      />

      <div className="animate-pop relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-bold">Askıya al</h2>
        <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-2">
          {username ? `@${username} için süre seç.` : "Süre seç."} Askı süresince ilan açamaz.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("temporary")}
            className={`rounded-xl border px-3 py-2 text-[0.75rem] font-semibold transition ${
              mode === "temporary"
                ? "border-accent/50 bg-accent/12 text-accent"
                : "border-line bg-white/4 text-muted"
            }`}
          >
            Süreli
          </button>
          <button
            type="button"
            onClick={() => setMode("permanent")}
            className={`rounded-xl border px-3 py-2 text-[0.75rem] font-semibold transition ${
              mode === "permanent"
                ? "border-danger/50 bg-danger/12 text-[#ffb3bb]"
                : "border-line bg-white/4 text-muted"
            }`}
          >
            Kalıcı
          </button>
        </div>

        {mode === "temporary" && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 7, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(String(value))}
                  className={`chip px-2.5 py-1 text-[0.7rem] ${
                    Number(days) === value ? "chip-active" : ""
                  }`}
                >
                  {value} gün
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                className="field h-10 text-[0.8rem]"
                type="number"
                inputMode="numeric"
                min={1}
                max={3650}
                value={days}
                onChange={(event) => setDays(event.target.value)}
                placeholder="Gün"
              />
              <span className="shrink-0 text-[0.7rem] text-muted-2">gün</span>
            </div>
            {invalid && (
              <p className="mt-1 text-[0.66rem] text-[#ffb3bb]">En az 1 gün gir.</p>
            )}
          </div>
        )}

        <div className="mt-3">
          <label htmlFor="ban-reason" className="mb-1 block text-[0.7rem] text-muted">
            Sebep (isteğe bağlı)
          </label>
          <input
            id="ban-reason"
            className="field h-10 text-[0.8rem]"
            value={reason}
            maxLength={160}
            onChange={(event) => setReason(event.target.value)}
            placeholder="ör. sahte ilan, hakaret"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn btn-ghost h-10 flex-1 text-sm"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(
                mode === "permanent" ? null : Math.round(numeric),
                reason.trim() ? reason.trim() : null,
              )
            }
            disabled={busy || invalid}
            className="btn btn-primary h-10 flex-1 text-sm disabled:opacity-60"
          >
            {busy ? "…" : "Askıya Al"}
          </button>
        </div>
      </div>
    </div>
  );
}
