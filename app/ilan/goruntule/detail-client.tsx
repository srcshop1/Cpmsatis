"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MessageIcon,
  ShieldIcon,
  StarIcon,
  XIcon,
} from "@/components/icons";
import { formatPrice } from "@/lib/catalog";
import { LISTINGS_TABLE, categoryLabel, type ListingSeller } from "@/lib/listings";
import { sanitizeHtml } from "@/lib/sanitize";
import { averageReviews, loadReviews, type Review, type ReviewAverages } from "@/lib/sales";
import {
  findOrCreateConversation,
  loadConversations,
  loadProfileMini,
  sendMessage,
} from "@/lib/social";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Detail = {
  id: string;
  title: string;
  description_html: string | null;
  price: number;
  category: string;
  images: string[] | null;
  created_at: string;
  featured_until: string | null;
  seller_id: string;
};

const REVIEW_ROWS = [
  { key: "satisfaction", label: "Memnuniyet" },
  { key: "trust", label: "Güvenilirlik" },
  { key: "communication", label: "İletişim" },
  { key: "delivery", label: "Teslimat" },
  { key: "overall", label: "Genel" },
] as const;

export function ListingDetailClient() {
  const searchParams = useSearchParams();
  const listingId = searchParams?.get("id") ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [listing, setListing] = useState<Detail | null>(null);
  const [seller, setSeller] = useState<ListingSeller | null>(null);
  const [sellerAverages, setSellerAverages] = useState<ReviewAverages | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<"listing" | "all">("all");
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactText, setContactText] = useState("Merhaba, bu ilan hâlâ satılık mı?");
  const [sending, setSending] = useState(false);

  const [sellOpen, setSellOpen] = useState(false);
  const [buyers, setBuyers] = useState<{ id: string; username: string }[]>([]);
  const [sellDone, setSellDone] = useState(false);

  const isOwner = Boolean(user && listing && user.id === listing.seller_id);

  useEffect(() => {
    if (!supabase || !listingId) {
      setState("error");
      setError("Supabase bağlantısı yok.");
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error: queryError } = await supabase
        .from(LISTINGS_TABLE)
        .select(
          "id,title,description_html,price,category,images,created_at,featured_until,seller_id",
        )
        .eq("id", listingId)
        .maybeSingle();

      if (cancelled) return;
      if (queryError) {
        setState("error");
        setError(queryError.message);
        return;
      }
      if (!data) {
        setState("missing");
        return;
      }

      const detail = data as Detail;
      setListing(detail);

      const profiles = await loadProfileMini(supabase, [detail.seller_id]);
      if (cancelled) return;
      setSeller(profiles.get(detail.seller_id) ?? null);

      const sellerReviews = await loadReviews(supabase, { sellerId: detail.seller_id });
      if (cancelled) return;
      setSellerAverages(averageReviews(sellerReviews));
      setReviews(sellerReviews);
      setState("ready");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, listingId]);

  useEffect(() => {
    if (tab !== "listing" || !supabase || !listing) return;
    void loadReviews(supabase, { listingId: listing.id }).then(setReviews);
  }, [tab, supabase, listing]);

  async function openContact() {
    if (!user || !listing) {
      router.push("/giris");
      return;
    }
    if (isOwner) {
      setSellOpen(true);
      setSellDone(false);
      if (supabase) {
        const rows = await loadConversations(supabase, user.id);
        const relevant = rows.filter((row) => row.listing_id === listing.id);
        setBuyers(
          relevant
            .map((row) => row.other)
            .filter((profile): profile is NonNullable<typeof profile> & { id: string } => Boolean(profile))
            .map((profile) => ({ id: profile.id, username: profile.username })),
        );
      }
      return;
    }
    setContactOpen(true);
  }

  async function sendContactMessage() {
    if (!supabase || !user || !listing || !seller) return;
    setSending(true);
    setError(null);

    const { conversationId, error: conversationError } = await findOrCreateConversation(
      supabase,
      { listingId: listing.id, meId: user.id, otherId: seller.id },
    );

    if (!conversationId) {
      setError(conversationError ?? "Sohbet açılamadı.");
      setSending(false);
      return;
    }

    const prefix = "Şu ilanla ilgileniyorum;";
    const body = `${prefix}\n${listing.title} — ${formatPrice(listing.price)}\n\n${contactText.trim()}`;
    const result = await sendMessage(supabase, {
      conversationId,
      senderId: user.id,
      body,
      listingRef: {
        id: listing.id,
        title: listing.title,
        price: listing.price,
        image: listing.images?.[0],
      },
    });

    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/mesajlar/sohbet?id=${conversationId}`);
  }

  async function markSold(buyerId: string) {
    if (!supabase || !listing) return;
    setSending(true);
    const { error: rpcError } = await supabase.rpc("mark_sold", {
      p_listing: listing.id,
      p_buyer: buyerId,
    });
    setSending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSellDone(true);
  }

  return (
    <AppShell>
      <Link
        href="/ilanlar"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> İlanlar
      </Link>

      {state === "loading" && (
        <div className="mt-4 space-y-3">
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-white/5" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-white/6" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/6" />
        </div>
      )}

      {state === "missing" && (
        <div className="mt-5 card px-6 py-14 text-center">
          <h1 className="text-base font-bold">İlan bulunamadı</h1>
          <p className="mt-1.5 text-sm text-muted-2">Kaldırılmış ya da hiç var olmamış olabilir.</p>
          <Link href="/ilanlar" className="btn btn-primary mt-4 h-10 px-5 text-sm">
            İlanlara dön
          </Link>
        </div>
      )}

      {state === "error" && (
        <div className="mt-5 card border-danger/30 px-5 py-6">
          <h1 className="text-sm font-bold text-danger">İlan yüklenemedi</h1>
          <p className="mt-1.5 break-words text-xs text-muted">{error}</p>
        </div>
      )}

      {state === "ready" && listing && (
        <div className="mt-4 space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-black/40">
            <div className="relative">
              {listing.images && listing.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.images[index]}
                  alt={listing.title}
                  className="max-h-[520px] w-full object-contain"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center text-4xl text-muted-2">
                  🖼️
                </div>
              )}

              {listing.featured_until && new Date(listing.featured_until) > new Date() && (
                <span className="absolute left-3 top-3 badge border border-accent/40 bg-accent/90 text-[0.65rem] font-bold text-ink">
                  <StarIcon width={11} height={11} /> ÖNE ÇIKAN
                </span>
              )}

              {listing.images && listing.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((prev) => (prev === 0 ? listing.images!.length - 1 : prev - 1))
                    }
                    className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
                    aria-label="Önceki görsel"
                  >
                    <ChevronLeftIcon width={18} height={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((prev) => (prev === listing.images!.length - 1 ? 0 : prev + 1))
                    }
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
                    aria-label="Sonraki görsel"
                  >
                    <ChevronRightIcon width={18} height={18} />
                  </button>
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[0.65rem] text-white">
                    {index + 1}/{listing.images.length}
                  </span>
                </>
              )}
            </div>

            {listing.images && listing.images.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto border-t border-line p-2">
                {listing.images.map((image, imageIndex) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setIndex(imageIndex)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${
                      imageIndex === index ? "border-accent" : "border-line"
                    }`}
                    aria-label={`Görsel ${imageIndex + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="badge border border-line bg-white/4 text-[0.62rem] text-muted">
                  {categoryLabel(listing.category)}
                </span>
                <h1 className="mt-2 text-lg font-extrabold leading-snug sm:text-xl">
                  {listing.title}
                </h1>
              </div>
              <p className="shrink-0 text-xl font-extrabold text-accent">
                {formatPrice(listing.price)}
              </p>
            </div>

            <p className="mt-2 inline-flex items-center gap-1 text-[0.68rem] text-muted-2">
              <ClockIcon width={12} height={12} />
              {new Date(listing.created_at).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-accent-soft to-accent-deep text-lg font-extrabold text-ink">
                {seller?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (seller?.username ?? "?").charAt(0).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                  @{seller?.username ?? "satıcı"}
                  {seller?.verified_seller && (
                    <span
                      className="text-mint"
                      title="Onaylı Satıcı"
                      aria-label="Onaylı Satıcı"
                    >
                      <ShieldIcon width={14} height={14} />
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-2">
                  <span className="inline-flex items-center gap-1 text-mint">
                    <CheckIcon width={12} height={12} />
                    {seller?.sales_count ?? 0} başarılı işlem
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <StarIcon width={11} height={11} className="text-accent" />
                    {sellerAverages && sellerAverages.count > 0
                      ? `${sellerAverages.overall.toFixed(1)} (${sellerAverages.count})`
                      : "puan yok"}
                  </span>
                </p>
              </div>
            </div>

            {isOwner ? (
              <button
                type="button"
                onClick={openContact}
                className="btn btn-primary mt-3 h-11 w-full"
              >
                Satış Yaptım — Müşteriyi Seç
              </button>
            ) : (
              <button
                type="button"
                onClick={openContact}
                className="btn btn-primary mt-3 h-11 w-full"
              >
                <MessageIcon width={17} height={17} /> Satıcı ile İletişime Geç
              </button>
            )}

            <p className="mt-2 flex items-start gap-1.5 text-[0.65rem] leading-relaxed text-muted-2">
              <ShieldIcon width={12} height={12} className="mt-0.5 shrink-0" />
              Sitede ödeme alınmaz. Anlaşmayı mesajlaşarak kendin yaparsın.
            </p>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold">Açıklama</h2>
            {listing.description_html ? (
              <div
                className="mt-2 text-[0.85rem] leading-relaxed text-muted [&_b]:text-text [&_strong]:text-text"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(listing.description_html) }}
              />
            ) : (
              <p className="mt-2 text-sm text-muted-2">Açıklama eklenmemiş.</p>
            )}
          </div>

          {/* Değerlendirmeler */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Değerlendirmeler</h2>
              <span className="text-[0.68rem] text-muted-2">
                {sellerAverages?.count ?? 0} değerlendirme
              </span>
            </div>

            {sellerAverages && sellerAverages.count > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {REVIEW_ROWS.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-lg border border-line-soft bg-white/3 px-2.5 py-2"
                  >
                    <p className="text-[0.62rem] text-muted-2">{row.label}</p>
                    <p className="mt-0.5 text-sm font-bold text-accent">
                      {sellerAverages[row.key].toFixed(1)}
                      <span className="text-[0.6rem] font-normal text-muted-2"> /5</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-1.5">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={`chip px-2.5 py-1 text-[0.7rem] ${tab === "all" ? "chip-active" : ""}`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setTab("listing")}
                className={`chip px-2.5 py-1 text-[0.7rem] ${
                  tab === "listing" ? "chip-active" : ""
                }`}
              >
                Bu ilan
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {reviews.length === 0 && (
                <p className="text-sm text-muted-2">
                  Henüz değerlendirme yok. Onaylanan satışlardan sonra alıcılar puan verir.
                </p>
              )}
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-line-soft bg-white/3 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-white/8 text-[0.6rem] font-bold text-muted">
                      {review.reviewer?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={review.reviewer.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (review.reviewer?.username ?? "?").charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="text-[0.75rem] font-semibold">
                      @{review.reviewer?.username ?? "alıcı"}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-0.5 text-[0.7rem] text-accent">
                      <StarIcon width={11} height={11} /> {review.overall}/5
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-muted">
                      {review.comment}
                    </p>
                  )}
                  <p className="mt-1.5 text-[0.6rem] text-muted-2">
                    {new Date(review.created_at).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* İletişim / satış modalı */}
      {(contactOpen || sellOpen) && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => {
              setContactOpen(false);
              setSellOpen(false);
            }}
            aria-label="Kapat"
          />
          <div className="animate-pop relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {sellOpen ? "Satış bildir" : "Satıcıya mesaj"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setContactOpen(false);
                  setSellOpen(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-2 hover:bg-white/5 hover:text-text"
                aria-label="Kapat"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>

            {listing?.images?.[0] && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white/3 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={listing.images[0]} alt="" className="h-11 w-11 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-[0.78rem] font-semibold">{listing.title}</p>
                  <p className="text-[0.68rem] text-muted-2">{formatPrice(listing.price)}</p>
                </div>
              </div>
            )}

            {sellOpen ? (
              sellDone ? (
                <div className="py-6 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-mint/30 bg-mint/10 text-mint">
                    <CheckIcon width={22} height={22} />
                  </span>
                  <p className="mt-3 text-sm font-semibold">Satış bildirimi gönderildi</p>
                  <p className="mt-1 text-xs text-muted-2">
                    Alıcı onayladığında başarılı işlem sayın artar.
                  </p>
                  <Link href="/siparisler" className="btn btn-primary mt-4 h-10 px-4 text-sm">
                    Siparişlere git
                  </Link>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-xs text-muted-2">
                    Bu ilan için konuştuğun kişilerden müşteriyi seç:
                  </p>
                  {buyers.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-line-soft bg-white/3 px-3 py-4 text-xs text-muted-2">
                      Bu ilan için henüz sohbet yok. Alıcı sana mesaj attığında burada listelenir.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {buyers.map((buyer) => (
                        <button
                          key={buyer.id}
                          type="button"
                          disabled={sending}
                          onClick={() => markSold(buyer.id)}
                          className="flex w-full items-center gap-2 rounded-lg border border-line-soft bg-white/3 px-3 py-2.5 text-left text-sm hover:border-accent/40"
                        >
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/8 text-[0.6rem] font-bold">
                            {buyer.username.charAt(0).toUpperCase()}
                          </span>
                          @{buyer.username}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )
            ) : (
              <>
                <p className="mt-3 text-[0.72rem] font-semibold text-accent">
                  Şu ilanla ilgileniyorum;
                </p>
                <textarea
                  value={contactText}
                  onChange={(event) => setContactText(event.target.value)}
                  rows={4}
                  className="field mt-1 resize-y"
                  maxLength={1500}
                />
                {error && <p className="mt-2 text-xs text-danger">{error}</p>}
                <button
                  type="button"
                  onClick={sendContactMessage}
                  disabled={sending}
                  className="btn btn-primary mt-3 h-11 w-full disabled:opacity-60"
                >
                  <MessageIcon width={16} height={16} /> Mesajı Gönder
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
