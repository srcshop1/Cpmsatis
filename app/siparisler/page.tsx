"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { CheckIcon, StarIcon, XIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { formatPrice } from "@/lib/catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createReview, loadSales, resolveSales, type Sale } from "@/lib/sales";

const STATUS_LABEL: Record<Sale["status"], string> = {
  pending_buyer: "Alıcı onayı bekleniyor",
  confirmed: "Alıcı doğruladı — onay bekliyor",
  approved: "Onaylandı",
  declined: "Alıcı reddetti",
  cancelled: "İptal edildi",
};

const REVIEW_FIELDS = [
  { key: "satisfaction", label: "Memnuniyet" },
  { key: "trust", label: "Güvenilirlik" },
  { key: "communication", label: "İletişim" },
  { key: "delivery", label: "Teslimat" },
  { key: "overall", label: "Genel" },
] as const;

type ReviewKey = (typeof REVIEW_FIELDS)[number]["key"];
type Ratings = Record<ReviewKey, number>;

const EMPTY_RATINGS: Ratings = {
  satisfaction: 5,
  trust: 5,
  communication: 5,
  delivery: 5,
  overall: 5,
};

export default function OrdersPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewSale, setReviewSale] = useState<Sale | null>(null);
  const [ratings, setRatings] = useState<Ratings>(EMPTY_RATINGS);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!supabase || !user) return;
    await resolveSales(supabase);
    setSales(await loadSales(supabase, user.id));
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user]);

  async function confirmSale(sale: Sale, accept: boolean) {
    if (!supabase) return;
    setBusyId(sale.id);
    const { error: rpcError } = await supabase.rpc("buyer_confirm", {
      p_sale: sale.id,
      p_accept: accept,
    });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setError(null);
    await refresh();
  }

  async function approve(sale: Sale) {
    if (!supabase) return;
    setBusyId(sale.id);
    const { error: rpcError } = await supabase.rpc("approve_sale", { p_sale: sale.id });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setError(null);
    await refresh();
  }

  async function submitReview() {
    if (!supabase || !user || !reviewSale) return;
    setBusyId(reviewSale.id);
    const result = await createReview(supabase, {
      saleId: reviewSale.id,
      listingId: reviewSale.listing_id,
      sellerId: reviewSale.seller_id,
      buyerId: user.id,
      satisfaction: ratings.satisfaction,
      trust: ratings.trust,
      communication: ratings.communication,
      delivery: ratings.delivery,
      overall: ratings.overall,
      comment,
    });
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReviewSale(null);
    setRatings(EMPTY_RATINGS);
    setComment("");
    await refresh();
  }

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Siparişler</h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">
        Satış onayları ve değerlendirmeler
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-[#ffb3bb]">
          {error}
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-muted-2">Yükleniyor…</p>}

      {!loading && sales.length === 0 && (
        <div className="mt-5 card px-5 py-12 text-center">
          <h2 className="text-base font-bold">Henüz sipariş yok</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-2">
            Satıcıysan ilanından <span className="text-muted">Satış yaptım</span> diyerek
            müşterini seç; alıcıysan satıcının bildirdiği satış burada görünür.
          </p>
          <Link href="/ilanlar" className="btn btn-primary mt-4 h-10 px-5 text-sm">
            İlanlara göz at
          </Link>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {sales.map((sale) => {
          const isBuyer = sale.buyer_id === user?.id;
          const hoursLeft = Math.max(
            0,
            Math.ceil((new Date(sale.auto_approve_at).getTime() - Date.now()) / 3600000),
          );

          return (
            <div key={sale.id} className="card p-3.5">
              <div className="flex gap-3">
                {sale.listing?.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sale.listing.images[0]}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-xl">
                    🖼️
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/ilan/${sale.listing_id}`}
                      className="line-clamp-2 text-[0.85rem] font-semibold hover:text-accent"
                    >
                      {sale.listing?.title ?? "İlan"}
                    </Link>
                    <span className="shrink-0 text-sm font-bold text-accent">
                      {sale.listing ? formatPrice(sale.listing.price) : ""}
                    </span>
                  </div>

                  <p className="mt-1 text-[0.68rem] text-muted-2">
                    {isBuyer ? "Alıcı" : "Satıcı"} · {STATUS_LABEL[sale.status]}
                    {sale.status !== "approved" && sale.status !== "declined" && (
                      <> · {hoursLeft} sa içinde otomatik onay</>
                    )}
                  </p>
                </div>
              </div>

              {isBuyer && sale.status === "pending_buyer" && (
                <div className="mt-3 rounded-xl border border-line-soft bg-white/3 p-2.5">
                  <p className="text-[0.72rem] text-muted">
                    Satıcı bu satışı yaptığını bildirdi. Doğru mu?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmSale(sale, true)}
                      disabled={busyId === sale.id}
                      className="btn btn-primary h-9 flex-1 text-xs"
                    >
                      {busyId === sale.id ? <Spinner /> : <><CheckIcon width={14} height={14} /> Evet</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmSale(sale, false)}
                      disabled={busyId === sale.id}
                      className="btn btn-ghost h-9 flex-1 text-xs"
                    >
                      <XIcon width={14} height={14} /> Hayır
                    </button>
                  </div>
                </div>
              )}

              {isBuyer && sale.status === "confirmed" && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => approve(sale)}
                    disabled={busyId === sale.id}
                    className="btn btn-primary h-9 flex-1 text-xs"
                  >
                    {busyId === sale.id ? <Spinner /> : <><CheckIcon width={14} height={14} /> Siparişi Onayla</>}
                  </button>
                  <Link href="/diger/destek" className="btn btn-ghost h-9 flex-1 text-xs">
                    Sorun var
                  </Link>
                </div>
              )}

              {isBuyer && sale.status === "approved" && !sale.review && (
                <button
                  type="button"
                  onClick={() => {
                    setReviewSale(sale);
                    setRatings(EMPTY_RATINGS);
                    setComment("");
                  }}
                  className="btn btn-primary mt-3 h-9 w-full text-xs"
                >
                  <StarIcon width={14} height={14} /> Satıcıyı Değerlendir
                </button>
              )}

              {sale.review && (
                <p className="mt-3 inline-flex items-center gap-1 rounded-lg border border-mint/25 bg-mint/8 px-2.5 py-1.5 text-[0.68rem] text-mint">
                  <StarIcon width={12} height={12} /> {sale.review.overall}/5 olarak
                  değerlendirildi
                </p>
              )}

              {!isBuyer && sale.status === "pending_buyer" && (
                <p className="mt-3 text-[0.68rem] text-muted-2">
                  Alıcının yanıtı bekleniyor. 24 saat içinde yanıt gelmezse otomatik onaylanır.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Değerlendirme modalı */}
      {reviewSale && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setReviewSale(null)}
            aria-label="Kapat"
          />
          <div className="animate-pop relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Satıcıyı değerlendir</h2>
              <button
                type="button"
                onClick={() => setReviewSale(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-2 hover:bg-white/5 hover:text-text"
                aria-label="Kapat"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>
            <p className="mt-1 text-[0.7rem] text-muted-2">
              Her başlık için 5 üzerinden yıldız ver.
            </p>

            <div className="mt-4 space-y-3">
              {REVIEW_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center justify-between gap-2">
                  <span className="text-[0.8rem] text-muted">{field.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setRatings((prev) => ({ ...prev, [field.key]: value }))
                        }
                        className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
                          ratings[field.key] >= value
                            ? "border-accent/50 bg-accent/15 text-accent"
                            : "border-line-soft bg-white/3 text-muted-2"
                        }`}
                        aria-label={`${field.label} ${value} yıldız`}
                      >
                        <StarIcon width={14} height={14} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="mt-4 block text-xs text-muted">Yorumun (opsiyonel)</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={3}
              className="field mt-1 resize-y"
              placeholder="Alışveriş deneyimini anlat…"
            />

            <button
              type="button"
              onClick={submitReview}
              disabled={busyId === reviewSale.id}
              className="btn btn-primary mt-3 h-11 w-full"
            >
              {busyId === reviewSale.id ? <Spinner /> : "Değerlendirmeyi Gönder"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
