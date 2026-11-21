"use client";

import { useEffect, useState } from "react";

export type ReasonOption = { key: string; label: string };

export type ReasonDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  required?: boolean;
  options?: ReasonOption[];
  onSubmit: (result: { note: string; choice: string }) => void;
  onCancel: () => void;
};

/** Yetkili notu / sonuç seçimi için site içi pencere (tarayıcı penceresi kullanılmaz) */
export function ReasonDialog({
  open,
  title,
  description,
  placeholder = "Yetkilinin yazdığı mesaj",
  confirmLabel = "Gönder",
  cancelLabel = "Vazgeç",
  danger = false,
  busy = false,
  required = false,
  options,
  onSubmit,
  onCancel,
}: ReasonDialogProps) {
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState(options?.[0]?.key ?? "");

  useEffect(() => {
    if (!open) return;
    setNote("");
    setChoice(options?.[0]?.key ?? "");
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const blocked = busy || (required && note.trim().length < 2);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Kapat"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 className="text-base font-bold leading-snug">{title}</h2>
          {description && (
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-2">{description}</p>
          )}

          {options && options.length > 0 && (
            <div className="mt-3 flex gap-2">
              {options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setChoice(option.key)}
                  className={`h-9 flex-1 rounded-xl border text-[0.78rem] font-bold transition ${
                    choice === option.key
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-line bg-white/4 text-muted hover:text-text"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <label className="mt-3 block text-[0.7rem] font-semibold text-muted-2">
            {options ? "Yetkili Notu" : "Yetkili Mesajı"}
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={placeholder}
            rows={4}
            maxLength={400}
            className="field mt-1.5 resize-none text-[0.8rem] leading-relaxed"
          />
          <p className="mt-1 text-right text-[0.62rem] text-muted-2">{note.length}/400</p>
        </div>

        <div className="flex gap-2 border-t border-line-soft bg-black/20 p-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost h-10 flex-1 text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ note: note.trim(), choice })}
            disabled={blocked}
            className={`h-10 flex-1 rounded-xl text-sm font-bold transition disabled:opacity-60 ${
              danger
                ? "bg-danger text-white hover:brightness-110"
                : "bg-gradient-to-br from-accent-soft to-accent-deep text-ink hover:brightness-105"
            }`}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
