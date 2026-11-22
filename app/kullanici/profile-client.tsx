"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { ChevronLeftIcon, MailIcon, StarIcon, UserIcon } from "@/components/icons";
import { ListingCard } from "@/components/listing-card";
import { FramedAvatar, StaffBadge, TagBadge, VerifiedBadge } from "@/components/user-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/listings";
import { averageReviews, loadReviews, type Review, type ReviewAverages } from "@/lib/sales";

type PublicProfile = {
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
  created_at: string;
};

const PROFILE_COLUMNS =
  "id, username, avatar_url, bio, rating, review_count, sales_count, verified_seller, staff_tag, equipped_frame, created_at";

const LISTING_COLUMNS = "id, title, price, category, categories, images, featured_until, created_at, seller_id";

export function UserProfileClient() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("id") ?? "";
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averages, setAverages] = useState<ReviewAverages | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      let { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        const retry = await supabase
          .from("profiles")
          .select("id, username, avatar_url, rating, review_count, sales_count, verified_seller, created_at")
          .eq("id", userId)
          .maybeSingle();
        data = retry.data as typeof data;
      }

      if (cancelled) return;
      const row = (data ?? null) as PublicProfile | null;
      setProfile(row);

      if (!row) {
        setLoading(false);
        return;
      }

      const seller = {
        id: row.id,
        username: row.username,
        avatar_url: row.avatar_url,
        sales_count: row.sales_count,
        rating: row.rating,
        review_count: row.review_count,
        verified_seller: row.verified_seller,
        staff_tag: row.staff_tag,
        equipped_frame: row.equipped_frame,
        last_seen_at: null,
      };

      const [{ data: tagRows }, listingResult, reviewRows] = await Promise.all([
        supabase.from("user_tags").select("tag").eq("user_id", row.id),
        supabase
          .from("listings")
          .select(LISTING_COLUMNS)
          .eq("seller_id", row.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(24),
        loadReviews(supabase, { sellerId: row.id }, 20),
      ]);

      if (cancelled) return;

      setTags(((tagRows ?? []) as { tag: string }[]).map((item) => item.tag));
      setListings(
        (((listingResult.data ?? []) as unknown) as Omit<Listing, "seller">[]).map((item) => ({
          ...item,
          seller,
        })),
      );
      setReviews(reviewRows);
      setAverages(averageReviews(reviewRows));
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  if (loading) {
    return (
      <AppShell>
        <p className="mt-6 text-sm text-muted-2">Yükleniyor…</p>
      </AppShell>
    );
  }

  if (!userId || !profile) {
    return (
      <AppShell>
        <div className="card mx-auto mt-8 max-w-md px-6 py-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white/4 text-muted-2">
            <UserIcon width={26} height={26} />
          </span>
          <h1 className="mt-4 text-base font-bold">Profil bulunamadı</h1>
          <p className="mt-1.5 text-sm text-muted-2">Bu kullanıcı silinmiş olabilir.</p>
          <Link href="/ilanlar" className="btn btn-ghost mt-4 h-10 px-4 text-sm">
            İlanlara dön
          </Link>
        </div>
      </AppShell>
    );
  }

  const reviewCount = profile.review_count ?? 0;
  const hasRating = reviewCount > 0 && Number(profile.rating ?? 0) > 0;

  return (
    <AppShell>
      <Link
        href="/mesajlar"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> Geri
      </Link>

      <div className="mt-2 card p-5">
        <div className="flex items-start gap-3">
          <FramedAvatar
            src={profile.avatar_url}
            username={profile.username}
            frame={profile.equipped_frame}
            size={62}
            rounded="rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">@{profile.username}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {profile.verified_seller && <VerifiedBadge small />}
              {tags
                .filter((tag) => tag === "vip" || tag === "premium")
                .map((tag) => (
                  <TagBadge key={tag} tag={tag} small />
                ))}
              {profile.staff_tag && <StaffBadge tag={profile.staff_tag} small />}
            </div>
          </div>
          {user?.id === profile.id && (
            <Link href="/profil" className="btn btn-ghost h-8 shrink-0 px-3 text-[0.7rem]">
              Düzenle
            </Link>
          )}
        </div>

        {profile.bio && (
          <p className="mt-3 whitespace-pre-line text-[0.8rem] leading-relaxed text-muted">
            {profile.bio}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 text-[0.68rem]">
          <span className="badge border border-line bg-white/4 text-muted">
            {profile.sales_count ?? 0} başarılı işlem
          </span>
          <span className="badge border border-line bg-white/4 text-muted">
            {hasRating
              ? `${Number(profile.rating).toFixed(1)} ★ (${reviewCount})`
              : "Değerlendirme yok"}
          </span>
          <span className="badge border border-line bg-white/4 text-muted">
            Üyelik: {new Date(profile.created_at).toLocaleDateString("tr-TR")}
          </span>
        </div>
      </div>

      <section className="mt-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <StarIcon width={16} height={16} className="text-accent" /> İlanları ({listings.length})
        </h2>
        {listings.length === 0 ? (
          <p className="mt-2 card px-4 py-8 text-center text-xs text-muted-2">
            Yayında ilanı yok.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <MailIcon width={16} height={16} className="text-accent" /> Değerlendirmeler
          </h2>
          <span className="text-[0.68rem] text-muted-2">{reviewCount} değerlendirme</span>
        </div>

        {averages && averages.count > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                <p className="text-[0.62rem] text-muted-2">{label}</p>
                <p className="mt-0.5 text-sm font-bold text-accent">
                  {(value as number).toFixed(1)}
                  <span className="text-[0.6rem] font-normal text-muted-2"> /5</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-2">
            Henüz değerlendirme yok. Onaylanan satışlardan sonra alıcılar puan verir.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-line-soft bg-white/3 p-3">
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] font-semibold">
                  @{review.reviewer?.username ?? "alıcı"}
                </span>
                <span className="ml-auto inline-flex items-center gap-0.5 text-[0.7rem] text-accent">
                  <StarIcon width={11} height={11} /> {review.overall}/5
                </span>
              </div>
              {review.comment && (
                <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
