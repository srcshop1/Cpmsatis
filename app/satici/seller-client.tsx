"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  CopyIcon,
  MessageIcon,
  ShareIcon,
  StarIcon,
  UserIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { ListingCard } from "@/components/listing-card";
import { FramedAvatar, StaffBadge, TagBadge, VerifiedBadge } from "@/components/user-badge";
import { sortTags } from "@/lib/badges";
import {
  loadExpiredListings,
  loadResponseMinutes,
  loadSellerListings,
  purgeExpiredListings,
  renewListing,
  responseLabel,
  type ExpiredListing,
  type Listing,
} from "@/lib/listings";
import { averageReviews, loadReviews, type Review, type ReviewAverages } from "@/lib/sales";
import { findOrCreateConversation } from "@/lib/social";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SellerProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  rating: number | null;
  review_count: number | null;
  sales_count: number | null;
  verified_seller: boolean | null;
  staff_tag: string | null;
  equipped_frame: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export function SellerShowcaseClient() {
  const searchParams = useSearchParams();
  const sellerId = searchParams?.get("id") ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averages, setAverages] = useState<ReviewAverages | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [copied, setCopied] = useState(false);
  const [responseMinutes, setResponseMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState<ExpiredListing[]>([]);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!supabase || !sellerId) {
      setState("missing");
      return;
    }
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, avatar_url, bio, rating, review_count, sales_count, verified_seller, staff_tag, equipped_frame, last_seen_at, created_at",
        )
        .eq("id", sellerId)
        .maybeSingle();

      let row = data as unknown as SellerProfile | null;
      if (error || !row) {
        const retry = await supabase
          .from("profiles")
          .select(
            "id, username, avatar_url, bio, rating, review_count, sales_count, verified_seller, last_seen_at, created_at",
          )
          .eq("id", sellerId)
          .maybeSingle();
        row = retry.data as unknown as SellerProfile | null;
      }

      if (cancelled) return;
      if (!row) {
        setState("missing");
        return;
      }
      setProfile(row);
      setState("ready");

      const [tagRes, rows, sellerReviews] = await Promise.all([
        supabase.from("user_tags").select("tag").eq("user_id", sellerId),
        loadSellerListings(supabase, { sellerId, limit: 60 }),
        loadReviews(supabase, { sellerId }),
      ]);

      if (cancelled) return;
      setTags(((tagRes.data ?? []) as { tag: string }[]).map((tagRow) => tagRow.tag));
      setListings(rows);
      setReviews(sellerReviews);
      setAverages(averageReviews(sellerReviews));

      const minutes = await loadResponseMinutes(supabase, sellerId);
      if (!cancelled) setResponseMinutes(minutes);

      // Kendi vitrininde: süresi dolmuş ilanları da göster (yenileme için)
      if (user?.id === sellerId) {
        await purgeExpiredListings(supabase);
        const expiredRows = await loadExpiredListings(supabase, sellerId);
        if (!cancelled) setExpired(expiredRows);
      } else if (!cancelled) {
        setExpired([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, sellerId, user?.id, reloadKey]);

  async function renewExpired(listingId: string) {
    if (!supabase || renewing) return;
    setRenewing(listingId);
    setNotice(null);
    const result = await renewListing(supabase, listingId);
    setRenewing(null);
    if (result && "error" in result && result.error) {
      setNotice("İlan yenilenemedi, tekrar dene.");
      return;
    }
    setReloadKey((key) => key + 1);
  }

  function hoursLeft(expiredAt: string) {
    const ms = new Date(expiredAt).getTime() + 2 * 86400000 - Date.now();
    return Math.max(0, Math.ceil(ms / 3600000));
  }

  function showcaseUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?id=${sellerId}`;
  }

  function shareOnWhatsApp() {
    if (!profile) return;
    const text = `@${profile.username} · CPM Satış vitrini\n${showcaseUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(showcaseUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // yoksay
    }
  }

  async function openChat() {
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!supabase || !sellerId || busy) return;
    setBusy(true);
    const result = await findOrCreateConversation(supabase, {
      listingId: null,
      meId: user.id,
      otherId: sellerId,
    });
    setBusy(false);
    if (result.conversationId) router.push(`/mesajlar/sohbet?id=${result.conversationId}`);
  }

  const isMe = Boolean(user && user.id === sellerId);
  const visibleReviews = reviews.filter((review) => review.comment).slice(0, 4);

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
          <div className="h-36 w-full animate-pulse rounded-2xl bg-white/5" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-44 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      )}

      {state === "missing" && (
        <div className="mt-5 card px-6 py-14 text-center">
          <h1 className="text-base font-bold">Satıcı bulunamadı</h1>
          <p className="mt-1.5 text-sm text-muted-2">Hesap kaldırılmış olabilir.</p>
          <Link href="/ilanlar" className="btn btn-primary mt-4 h-10 px-5 text-sm">
            İlanlara dön
          </Link>
        </div>
      )}

      {state === "ready" && profile && (
        <div className="mt-4 space-y-4">
          <div className="card overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-accent/25 via-accent/8 to-transparent" />
            <div className="-mt-10 px-4 pb-4">
              <FramedAvatar
                src={profile.avatar_url}
                username={profile.username}
                frame={profile.equipped_frame}
                size={72}
                rounded="rounded-2xl"
              />
              <h1 className="mt-2 flex flex-wrap items-center gap-1.5 text-lg font-extrabold">
                @{profile.username}
                {profile.verified_seller && <VerifiedBadge small />}
                {sortTags(tags.filter((tag) => tag === "vip" || tag === "premium")).map((tag) => (
                  <TagBadge key={tag} tag={tag} small />
                ))}
                {profile.staff_tag && <StaffBadge tag={profile.staff_tag} small />}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 font-semibold text-accent">
                  <StarIcon width={11} height={11} />
                  {(profile.review_count ?? 0) > 0
                    ? `${Number(profile.rating ?? 0).toFixed(1)} (${profile.review_count})`
                    : "puan yok"}
                </span>
                <span className="inline-flex items-center gap-1 text-mint">
                  <CheckIcon width={12} height={12} /> {profile.sales_count ?? 0} başarılı işlem
                </span>
                {responseLabel(responseMinutes) && (
                  <span className="inline-flex items-center gap-1 text-mint">
                    <MessageIcon width={11} height={11} /> {responseLabel(responseMinutes)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <ClockIcon width={12} height={12} />
                  {new Date(profile.created_at).toLocaleDateString("tr-TR", {
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  tarihinden beri
                </span>
              </div>

              {profile.bio && (
                <p className="mt-2 whitespace-pre-wrap break-words text-[0.8rem] leading-relaxed text-muted">
                  {profile.bio}
                </p>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2">
                {!isMe && (
                  <button
                    type="button"
                    onClick={() => void openChat()}
                    disabled={busy}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/12 text-[0.75rem] font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-60"
                  >
                    <MessageIcon width={15} height={15} /> Mesaj
                  </button>
                )}
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
                {isMe && (
                  <Link
                    href="/profil"
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white/4 text-[0.75rem] font-semibold text-muted transition hover:text-text"
                  >
                    <UserIcon width={15} height={15} /> Profilim
                  </Link>
                )}
              </div>

              <Link
                href={`/kullanici?id=${profile.id}`}
                className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-semibold text-accent hover:underline"
              >
                Değerlendirmeleri ve tam profil <ShareIcon width={11} height={11} />
              </Link>
            </div>
          </div>

          {averages && averages.count > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-bold">Puanlar</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Memnuniyet", averages.satisfaction],
                  ["Güvenilirlik", averages.trust],
                  ["İletişim", averages.communication],
                  ["Teslimat", averages.delivery],
                  ["Genel", averages.overall],
                ].map(([label, value]) => (
                  <div
                    key={label as string}
                    className="rounded-lg border border-line-soft bg-white/3 px-2.5 py-2"
                  >
                    <p className="text-[0.6rem] text-muted-2">{label as string}</p>
                    <p className="text-sm font-bold text-accent">
                      {(value as number).toFixed(1)}
                      <span className="text-[0.58rem] font-normal text-muted-2"> /5</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isMe && expired.length > 0 && (
            <div className="card border-[#ffb3bb]/30 p-4">
              <h2 className="text-sm font-bold">Süresi dolan ilanların ({expired.length})</h2>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-2">
                Yenilemezsen ilan kendiliğinden silinir. Satışı olan ilanlar silinmez.
              </p>
              {notice && <p className="mt-1 text-[0.68rem] text-[#ffb3bb]">{notice}</p>}
              <div className="mt-2 space-y-2">
                {expired.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 rounded-xl border border-line-soft bg-white/3 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.78rem] font-semibold">{row.title}</p>
                      <p className="text-[0.62rem] text-[#ffb3bb]">
                        {hoursLeft(row.expired_at)} saat içinde silinir
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void renewExpired(row.id)}
                      disabled={renewing === row.id}
                      className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[0.68rem] font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-60"
                    >
                      {renewing === row.id ? "…" : "Yenile"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">İlanları ({listings.length})</h2>
            </div>
            {listings.length === 0 ? (
              <p className="mt-2 text-sm text-muted-2">Şu an yayında ilanı yok.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>

          {visibleReviews.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-bold">Son değerlendirmeler</h2>
              <div className="mt-2 space-y-2">
                {visibleReviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-line-soft bg-white/3 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.72rem] font-semibold">
                        @{review.reviewer?.username ?? "alıcı"}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-0.5 text-[0.68rem] text-accent">
                        <StarIcon width={11} height={11} /> {review.overall}/5
                      </span>
                    </div>
                    <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
