"use client";

import { useEffect } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Tarayıcı penceresi yerine sitenin kendi onay penceresi */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
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
        className="animate-pop relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="p-5">
          <h2 className="text-base font-bold leading-snug">{title}</h2>
          {description && (
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-2">{description}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-line-soft bg-black/20 p-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost h-10 flex-1 text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
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
