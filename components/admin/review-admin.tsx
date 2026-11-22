"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StarIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { clearReviewsAsStaff, deleteReviewAsStaff, setReviewStatusAsStaff } from "@/lib/admin";
import { loadReviews, type Review } from "@/lib/sales";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Kalan değerlendirmelerin sayısı ve ortalaması */
function summarize(rows: Review[]) {
  if (rows.length === 0) return { remaining: 0, average: null as number | null };
  const total = rows.reduce((sum, row) => sum + Number(row.overall ?? 0), 0);
  return { remaining: rows.length, average: Math.round((total / rows.length) * 100) / 100 };
}

/** Bir kullanıcının aldığı değerlendirmeleri listeler, yetkili olarak kaldırmaya izin verir. */
export function AdminReviewList({
  sellerId,
  canClearAll = false,
  limit = 50,
  onChanged,
}: {
  sellerId: string;
  canClearAll?: boolean;
  limit?: number;
  onChanged?: (summary: { remaining: number; average: number | null }) => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Review | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const rows = await loadReviews(supabase, { sellerId }, limit);
    setReviews(rows);
    setLoading(false);
  }, [supabase, sellerId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeReview() {
    if (!supabase || !removeTarget) return;
    setBusy(true);
    setNotice(null);
    const { error } = await deleteReviewAsStaff(supabase, removeTarget.id);
    setBusy(false);
    setRemoveTarget(null);
    if (error) {
      setNotice(error);
      return;
    }
    const next = reviews.filter((row) => row.id !== removeTarget.id);
    setReviews(next);
    setNotice("Değerlendirme kaldırıldı.");
    onChanged?.(summarize(next));
  }

  async function changeStatus(review: Review, status: "approved" | "pending") {
    if (!supabase) return;
    setBusy(true);
    setNotice(null);
    const result = await setReviewStatusAsStaff(supabase, review.id, status);
    setBusy(false);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    const next = reviews.map((row) => (row.id === review.id ? { ...row, status } : row));
    setReviews(next);
    setNotice(status === "approved" ? "Değerlendirme onaylandı." : "Değerlendirme şüpheliye alındı.");
    onChanged?.(summarize(next.filter((row) => (row.status ?? "approved") === "approved")));
  }

  async function clearAll() {
    if (!supabase) return;
    setBusy(true);
    setNotice(null);
    const result = await clearReviewsAsStaff(supabase, sellerId);
    setBusy(false);
    setClearOpen(false);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setReviews([]);
    setNotice(
      result.removed > 0
        ? `${result.removed} değerlendirme kaldırıldı.`
        : "Kaldırılacak değerlendirme yok.",
    );
    onChanged?.(summarize([]));
  }

  return (
    <div className="rounded-xl border border-line-soft bg-white/3 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-2">
          Değerlendirmeler ({reviews.length})
        </p>
        {canClearAll && reviews.length > 0 && (
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            className="text-[0.62rem] font-semibold text-danger hover:underline"
          >
            Tümünü kaldır
          </button>
        )}
      </div>

      {loading && (
        <p className="flex items-center gap-1.5 py-2 text-[0.72rem] text-muted-2">
          <Spinner /> Yükleniyor…
        </p>
      )}

      {!loading && reviews.length === 0 && (
        <p className="py-1 text-[0.72rem] text-muted-2">Değerlendirme yok.</p>
      )}

      {!loading &&
        reviews.map((review) => (
          <div
            key={review.id}
            className="flex items-start gap-2 border-b border-line-soft py-2 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold">
                <span className="text-accent">
                  <StarIcon width={10} height={10} /> {review.overall}/5
                </span>
                <span className="truncate text-muted-2">
                  @{review.reviewer?.username ?? "alıcı"}
                </span>
                <span className="text-[0.58rem] text-muted-2">
                  {new Date(review.created_at).toLocaleDateString("tr-TR")}
                </span>
              </p>
              {review.comment && (
                <p className="mt-0.5 break-words text-[0.72rem] leading-relaxed text-muted">
                  {review.comment}
                </p>
              )}
              {(review.status ?? "approved") !== "approved" && review.flag_reason && (
                <p className="mt-0.5 text-[0.58rem] text-[#ffd166]">
                  Şüphe: {review.flag_reason}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {(review.status ?? "approved") !== "approved" && (
                <span
                  className="rounded-md border border-[#ffd166]/50 bg-[#ffd166]/12 px-1.5 py-0.5 text-[0.55rem] font-bold text-[#ffd166]"
                  title={review.flag_reason ?? undefined}
                >
                  İNCELEME
                </span>
              )}
              {(review.status ?? "approved") !== "approved" && (
                <button
                  type="button"
                  onClick={() => void changeStatus(review, "approved")}
                  disabled={busy}
                  className="rounded-md border border-mint/40 bg-mint/12 px-2 py-1 text-[0.6rem] font-semibold text-mint hover:bg-mint/20 disabled:opacity-50"
                >
                  Onayla
                </button>
              )}
              <button
                type="button"
                onClick={() => setRemoveTarget(review)}
                className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[0.6rem] font-semibold text-[#ffb3bb] hover:bg-danger/20"
              >
                Kaldır
              </button>
            </div>
          </div>
        ))}

      {notice && <p className="mt-2 text-[0.68rem] text-accent">{notice}</p>}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Değerlendirme kaldırılsın mı?"
        description={
          removeTarget
            ? `@${removeTarget.reviewer?.username ?? "alıcı"} tarafından yazılan ${removeTarget.overall}/5 puanlı değerlendirme kalıcı olarak silinecek. Satıcının puanı yeniden hesaplanır.`
            : undefined
        }
        confirmLabel="Kaldır"
        danger
        busy={busy}
        onConfirm={removeReview}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Tüm değerlendirmeler kaldırılsın mı?"
        description="Bu kullanıcının aldığı bütün değerlendirmeler silinecek ve puanı sıfırlanacak."
        confirmLabel="Tümünü kaldır"
        danger
        busy={busy}
        onConfirm={clearAll}
        onCancel={() => setClearOpen(false)}
      />
    </div>
  );
}
