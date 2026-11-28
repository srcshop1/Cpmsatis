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
  CopyIcon,
  EyeIcon,
  HeartIcon,
  MessageIcon,
  ShareIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
  TrashIcon,
  StarIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/icons";
import { ListingCard } from "@/components/listing-card";
import { Price } from "@/components/price";
import { formatPriceLabel } from "@/lib/catalog";
import {
  LISTING_LIFETIME_DAYS,
  LISTINGS_TABLE,
  categoryLabel,
  daysLeft,
  isExpired,
  isListingFavorited,
  listingExpiresAt,
  loadListingCounters,
  loadRelatedListings,
  loadResponseMinutes,
  loadSellerListings,
  discountOf,
  responseLabel,
  registerListingView,
  renewListing,
  toggleListingFavorite,
  type Listing,
  type ListingSeller,
} from "@/lib/listings";
import { FramedAvatar, StaffBadge, TagBadge, VerifiedBadge } from "@/components/user-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  categories: string[] | null;
  images: string[] | null;
  created_at: string;
  featured_until: string | null;
  seller_id: string;
  view_count?: number | null;
  favorite_count?: number | null;
  previous_price?: number | null;
  price_dropped_at?: string | null;
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
  const [sellerTags, setSellerTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [featuredOpen, setFeaturedOpen] = useState(false);
  const [featuredDays, setFeaturedDays] = useState(3);
  const [featuredBusy, setFeaturedBusy] = useState(false);
  const [featuredPending, setFeaturedPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [views, setViews] = useState(0);
  const [favorites, setFavorites] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [related, setRelated] = useState<Listing[]>([]);
  const [responseMinutes, setResponseMinutes] = useState<number | null>(null);
  const [sellerListings, setSellerListings] = useState<Listing[]>([]);

  const isOwner = Boolean(user && listing && user.id === listing.seller_id);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!supabase || !listingId) {
      setState("error");
      setError("İlan şu an yüklenemedi. Sayfayı yenileyip tekrar dene.");
      return;
    }
    let cancelled = false;

    const load = async () => {
      const baseColumns =
        "id,title,description_html,price,category,images,created_at,featured_until,seller_id";

      let queryResult = await supabase
        .from(LISTINGS_TABLE)
        .select(`${baseColumns},categories,view_count,favorite_count,previous_price,price_dropped_at`)
        .eq("id", listingId)
        .maybeSingle();

      let data: Record<string, unknown> | null = queryResult.data as unknown as Record<
        string,
        unknown
      > | null;
      let queryError = queryResult.error;

      // categories kolonu yoksa (v4 SQL çalıştırılmamış) temel alanlarla devam et
      if (queryError && /categories|column/i.test(queryError.message)) {
        const retry = await supabase
          .from(LISTINGS_TABLE)
          .select(baseColumns)
          .eq("id", listingId)
          .maybeSingle();
        data = retry.data
          ? { ...(retry.data as unknown as Record<string, unknown>), categories: null }
          : null;
        queryError = retry.error;
      }

      if (cancelled) return;
      if (queryError) {
        console.error("[ilan]", queryError.message);
        setState("error");
        setError("İlan şu an yüklenemedi. Sayfayı yenileyip tekrar dene.");
        return;
      }
      if (!data) {
        setState("missing");
        return;
      }

      const detail = data as unknown as Detail;
      setListing(detail);
      setViews(Number(detail.view_count ?? 0));
      setFavorites(Number(detail.favorite_count ?? 0));

      // Görüntülenme: sahibi hariç, aynı kişi 6 saatte bir sayılır
      if (user?.id !== detail.seller_id) {
        void registerListingView(supabase, detail.id, user?.id ?? null).then((total) => {
          if (!cancelled && total !== null) setViews(total);
        });
      } else {
        void loadListingCounters(supabase, detail.id).then((counters) => {
          if (!cancelled) {
            setViews(counters.views);
            setFavorites(counters.favorites);
          }
        });
      }

      const cats =
        detail.categories && detail.categories.length > 0
          ? detail.categories
          : [detail.category].filter(Boolean);

      void loadSellerListings(supabase, { sellerId: detail.seller_id, excludeId: detail.id, limit: 6 })
        .then((rows) => {
          if (!cancelled) setSellerListings(rows);
        });
      void loadRelatedListings(supabase, {
        categories: cats,
        excludeId: detail.id,
        sellerId: detail.seller_id,
        limit: 6,
      }).then((rows) => {
        if (!cancelled) setRelated(rows);
      });

      if (user?.id) {
        void isListingFavorited(supabase, user.id, detail.id).then((value) => {
          if (!cancelled) setFavorited(value);
        });
      }

      void loadResponseMinutes(supabase, detail.seller_id).then((minutes) => {
        if (!cancelled) setResponseMinutes(minutes);
      });

      const profiles = await loadProfileMini(supabase, [detail.seller_id]);
      if (cancelled) return;
      setSeller(profiles.get(detail.seller_id) ?? null);

      const { data: tagRows } = await supabase
        .from("user_tags")
        .select("tag")
        .eq("user_id", detail.seller_id);
      if (!cancelled) {
        setSellerTags(((tagRows ?? []) as { tag: string }[]).map((row) => row.tag));
      }

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
  }, [supabase, listingId, user?.id]);

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

  async function toggleFavorite() {
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!supabase || !listing || favBusy) return;
    setFavBusy(true);
    const result = await toggleListingFavorite(supabase, user.id, listing.id);
    setFavBusy(false);
    if (result.error || result.favorited === null) {
      setNotice(result.error ?? "Favori kaydedilemedi.");
      return;
    }
    setFavorited(result.favorited);
    setFavorites((prev) => Math.max(0, prev + (result.favorited ? 1 : -1)));
  }

  function listingUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?id=${listingId}`;
  }

  function shareOnWhatsApp() {
    if (!listing) return;
    const text = `${listing.title}\n${listingUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    const url = listingUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("Link kopyalanamadı.");
    }
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
    const body = `${prefix}\n${listing.title} — ${formatPriceLabel(listing.price)}\n\n${contactText.trim()}`;
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

  useEffect(() => {
    if (!supabase || !listing || !isOwner) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("featured_requests")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      if (!cancelled) setFeaturedPending(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, listing, isOwner]);

  async function requestFeatured() {
    if (!supabase || !user || !listing) return;
    setFeaturedBusy(true);
    setNotice(null);
    const { error: requestError } = await supabase.rpc("request_featured", {
      p_listing: listing.id,
      p_days: featuredDays,
    });
    setFeaturedBusy(false);
    setFeaturedOpen(false);
    if (requestError) {
      const text = requestError.message ?? "";
      // Sunucu kuralı Türkçe anlatıyorsa onu göster, yoksa genel mesaj
      setNotice(
        /[çğıöşüÇĞİÖŞÜ]/.test(text) && !/could not find|schema cache|function/i.test(text)
          ? text
          : "Talep gönderilemedi. Lütfen tekrar dene.",
      );
      return;
    }
    setFeaturedPending(true);
    setNotice("Öne çıkarma talebin yetkiliye gönderildi. Onaylanınca ilan öne çıkar.");
  }

  const canRenew = Boolean(
    listing && (isExpired(listing.created_at) || daysLeft(listing.created_at) <= 1),
  );

  async function renew() {
    if (!supabase || !listing) return;
    setSending(true);
    const result = await renewListing(supabase, listing.id);
    setSending(false);
    if ("error" in result && result.error) {
      console.error("[ilan-yenile]", result.error.message);
      setError("İlan yenilenemedi. Lütfen tekrar dene.");
      return;
    }
    setListing({ ...listing, created_at: new Date().toISOString() });
  }

  async function deleteListing() {
    if (!supabase || !listing) return;
    setConfirmDelete(false);
    setSending(true);
    const { error: deleteError } = await supabase
      .from(LISTINGS_TABLE)
      .delete()
      .eq("id", listing.id);
    setSending(false);
    if (deleteError) {
      console.error("[ilan-sil]", deleteError.message);
      setError("İlan silinemedi. Lütfen tekrar dene.");
      return;
    }
    router.push("/ilanlar");
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
      console.error("[satis]", rpcError.message);
      setError("Satış bildirimi gönderilemedi. Lütfen tekrar dene.");
      return;
    }
    setSellDone(true);
  }

  return (
    <AppShell>
      {notice && (
        <div className="fixed bottom-24 left-1/2 z-[90] w-[min(92vw,24rem)] -translate-x-1/2 rounded-xl border border-line bg-surface/95 px-4 py-2.5 text-center text-xs leading-relaxed text-text shadow-2xl backdrop-blur">
          {notice}
        </div>
      )}

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
          <p className="mt-1.5 text-xs text-muted">{error}</p>
        </div>
      )}

      {state === "ready" && listing && (
        <div className="mt-4 space-y-4">
          <div
            className={`relative overflow-hidden rounded-2xl border bg-black/40 ${
              listing.featured_until && new Date(listing.featured_until) > new Date()
                ? "border-[#3b82f6]/70 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]"
                : "border-line"
            }`}
          >
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
                <span className="absolute left-3 top-3 badge border border-[#93c5fd]/50 bg-[#2563eb] text-[0.65rem] font-bold text-white">
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
                <span className="flex flex-wrap gap-1">
                  {(listing.categories && listing.categories.length > 0
                    ? listing.categories
                    : [listing.category]
                  ).map((slug) => (
                    <span
                      key={slug}
                      className="badge border border-line bg-white/4 text-[0.62rem] text-muted"
                    >
                      {categoryLabel(slug)}
                    </span>
                  ))}
                </span>
                <h1 className="mt-2 text-lg font-extrabold leading-snug sm:text-xl">
                  {listing.title}
                </h1>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-extrabold text-accent">
                  <Price value={listing.price} iconSize={20} />
                </p>
                {(() => {
                  const discount = discountOf(listing);
                  if (!discount) return null;
                  return (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-mint/40 bg-mint/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-mint">
                      %{discount.percent} İNDİRİM ·{" "}
                      <span className="line-through opacity-70">
                        {discount.original.toLocaleString("tr-TR")}
                      </span>
                    </p>
                  );
                })()}
              </div>
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-2">
              <span className="inline-flex items-center gap-1">
                <ClockIcon width={12} height={12} />
                {new Date(listing.created_at).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  daysLeft(listing.created_at) <= 3 ? "text-[#ffb3bb]" : "text-muted-2"
                }`}
              >
                {daysLeft(listing.created_at)} gün kaldı ·{" "}
                {listingExpiresAt(listing.created_at).toLocaleDateString("tr-TR")} tarihinde kalkar
              </span>
              <span className="inline-flex items-center gap-1">
                <EyeIcon width={12} height={12} />
                {views > 0 ? `${views} kişi baktı` : "Henüz görüntülenme yok"}
              </span>
              <span className="inline-flex items-center gap-1">
                <HeartIcon width={12} height={12} /> {favorites} favori
              </span>
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void toggleFavorite()}
                  disabled={favBusy}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[0.75rem] font-semibold transition disabled:opacity-60 ${
                    favorited
                      ? "border-[#ff7b8a]/50 bg-[#ff7b8a]/12 text-[#ff9ba5]"
                      : "border-line bg-white/4 text-muted hover:text-text"
                  }`}
                >
                  <HeartIcon width={15} height={15} filled={favorited} />
                  {favorited ? "Favorilerimde" : "Favorile"}
                </button>
                <button
                  type="button"
                  onClick={shareOnWhatsApp}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-mint/40 bg-mint/10 text-[0.75rem] font-semibold text-mint transition hover:bg-mint/20"
                >
                  <WhatsAppIcon width={15} height={15} /> Paylaş
                </button>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white/4 text-[0.75rem] font-semibold text-muted transition hover:text-text"
                >
                  {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
                {copied ? "Kopyalandı" : "Link"}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-start gap-3">
              <FramedAvatar
                src={seller?.avatar_url}
                username={seller?.username}
                frame={seller?.equipped_frame}
                size={48}
                rounded="rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/satici?id=${listing.seller_id}`}
                  className="block truncate text-[0.95rem] font-bold hover:text-accent"
                >
                  @{seller?.username ?? "satıcı"}
                </Link>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {seller?.verified_seller && <VerifiedBadge small />}
                  {sellerTags
                    .filter((tag) => tag === "vip" || tag === "premium")
                    .map((tag) => (
                      <TagBadge key={tag} tag={tag} small />
                    ))}
                  {seller?.staff_tag && <StaffBadge tag={seller.staff_tag} small />}
                </div>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-2">
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
                  {responseLabel(responseMinutes) && (
                    <span className="inline-flex items-center gap-1 text-mint">
                      <ClockIcon width={11} height={11} /> {responseLabel(responseMinutes)}
                    </span>
                  )}
                  {seller?.last_seen_at && (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon width={11} height={11} />
                      {new Date(seller.last_seen_at).getTime() > Date.now() - 10 * 60 * 1000
                        ? "şu an aktif"
                        : "son görülme " +
                          new Date(seller.last_seen_at).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <Link
              href={`/satici?id=${listing.seller_id}`}
              className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-semibold text-accent hover:underline"
            >
              Satıcı vitrinini gör <ChevronRightIcon width={12} height={12} />
            </Link>

            {isOwner ? (
              <div className="mt-3 space-y-2"
              >
                <button type="button" onClick={openContact} className="btn btn-primary h-11 w-full">
                  Satış Yaptım — Müşteriyi Seç
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setFeaturedOpen(true);
                  }}
                  disabled={sending || featuredPending}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#3b82f6]/40 bg-[#3b82f6]/10 text-sm font-semibold text-[#93c5fd] transition hover:bg-[#3b82f6]/20 disabled:opacity-60"
                >
                  <StarIcon width={15} height={15} />
                  {featuredPending ? "Öne çıkarma talebi onay bekliyor" : "Öne Çıkarma Talebi Gönder"}
                </button>
                <Link
                  href={`/ilan/duzenle?id=${listing.id}`}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 text-sm font-semibold text-accent transition hover:bg-accent/20"
                >
                  <SparkIcon width={15} height={15} /> İlanı Düzenle
                </Link>
                <button
                  type="button"
                  onClick={renew}
                  disabled={sending || !canRenew}
                  title={
                    canRenew
                      ? `İlanı ${LISTING_LIFETIME_DAYS} gün daha yayında tut`
                      : "İlanın süresi dolmadan yenilenemez. Son 1 gün kaldığında yenileyebilirsin."
                  }
                  className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition disabled:opacity-45 ${
                    canRenew
                      ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
                      : "border-line bg-white/4 text-muted-2"
                  }`}
                >
                  <ClockIcon width={15} height={15} />
                  {canRenew
                    ? `İlanı Yenile (${LISTING_LIFETIME_DAYS} gün)`
                    : `Yenileme ${daysLeft(listing.created_at) - 1} gün sonra açılır`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={sending}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-danger/30 bg-danger/8 text-sm font-semibold text-[#ffb3bb] transition hover:bg-danger/15 disabled:opacity-60"
                >
                  <TrashIcon width={15} height={15} /> İlanı Sil
                </button>
              </div>
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
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.55rem] leading-none">
                    {[
                      ["Mem", "Memnuniyet", review.satisfaction],
                      ["Güv", "Güvenilirlik", review.trust],
                      ["İle", "İletişim", review.communication],
                      ["Tes", "Teslimat", review.delivery],
                      ["Gen", "Genel", review.overall],
                    ].map(([short, long, value]) => (
                      <span
                        key={short as string}
                        title={long as string}
                        className="inline-flex items-center gap-1 rounded border border-line-soft bg-white/4 px-1 py-[2px] text-muted-2"
                      >
                        {short}
                        <span className="font-bold text-accent">{value as number}</span>
                      </span>
                    ))}
                  </div>
                  {review.comment && (
                    <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">
                      {review.comment}
                    </p>
                  )}
                  {review.reply && (
  <div className="mt-1.5 rounded-lg border-l-2 border-accent/60 bg-white/5 px-2.5 py-1.5">
    <p className="text-[0.6rem] font-semibold text-accent">Satıcı yanıtı</p>
    <p className="mt-0.5 whitespace-pre-line break-words text-[0.74rem] leading-relaxed text-muted">
      {review.reply}
    </p>
  </div>
)}
                  <p className="mt-1 text-[0.6rem] text-muted-2">
                    {new Date(review.created_at).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {sellerListings.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">Satıcının diğer ilanları</h2>
                <Link
                  href={`/satici?id=${listing.seller_id}`}
                  className="text-[0.68rem] font-semibold text-accent hover:underline"
                >
                  Tümü
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {sellerListings.map((item) => (
                  <ListingCard key={item.id} listing={item} />
                ))}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-bold">Benzer ilanlar</h2>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {related.map((item) => (
                  <ListingCard key={item.id} listing={item} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-mint/40 bg-mint/10 text-[0.75rem] font-semibold text-mint transition hover:bg-mint/20"
              >
                <ShareIcon width={15} height={15} /> WhatsApp'ta paylaş
              </button>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white/4 text-[0.75rem] font-semibold text-muted transition hover:text-text"
              >
                {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
              {copied ? "Link kopyalandı" : "Linki kopyala"}
            </button>
          </div>
        </div>
      )}

      {featuredOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setFeaturedOpen(false)}
            aria-label="Kapat"
          />
          <div className="animate-pop relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
            <h2 className="text-base font-bold">Öne çıkarma talebi</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-2">
              Talep yetkiliye gider. Onaylanınca ilan seçtiğin süre boyunca öne çıkarılır ve mavi
              çerçeveyle gösterilir.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[1, 3, 7].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setFeaturedDays(day)}
                  className={`chip ${featuredDays === day ? "chip-active" : ""}`}
                >
                  {day} gün
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setFeaturedOpen(false)}
                className="btn btn-ghost h-10 flex-1 text-sm"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void requestFeatured()}
                disabled={featuredBusy}
                className="btn btn-primary h-10 flex-1 text-sm"
              >
                {featuredBusy ? "…" : "Talep Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="İlan silinsin mi?"
        description="İlanın yayından tamamen kaldırılacak. Bu işlem geri alınamaz."
        confirmLabel="İlanı Sil"
        danger
        busy={sending}
        onConfirm={deleteListing}
        onCancel={() => setConfirmDelete(false)}
      />

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
                  <p className="text-[0.68rem] text-muted-2"><Price value={listing.price} iconSize={11} /></p>
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
