"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StaffBadge, TagBadge, VerifiedBadge } from "@/components/user-badge";
import { formatPrice } from "@/lib/catalog";
import { findFrame } from "@/lib/frames";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  rating: number | null;
  review_count: number | null;
  sales_count: number | null;
  verified_seller: boolean | null;
  staff_tag: string | null;
  equipped_frame: string | null;
  banned: boolean | null;
  bio: string | null;
  last_seen_at: string | null;
  created_at: string;
};

type ListingRow = {
  id: string;
  title: string;
  price: number;
  status: string;
  created_at: string;
};

type ReviewRow = {
  id: string;
  overall: number;
  comment: string | null;
  created_at: string;
};

type Detail = {
  profile: Profile | null;
  listings: ListingRow[];
  reviews: ReviewRow[];
  tags: string[];
  frames: string[];
  salesAsSeller: number;
  salesAsBuyer: number;
  conversations: number;
  reports: number;
  tickets: number;
};

export function MemberDetail({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const [
        profileRes,
        listingsRes,
        reviewsRes,
        tagsRes,
        framesRes,
        sellerSalesRes,
        buyerSalesRes,
        conversationsRes,
        reportsRes,
        ticketsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("listings")
          .select("id, title, price, status, created_at")
          .eq("seller_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("reviews")
          .select("id, overall, comment, created_at")
          .eq("seller_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("user_tags").select("tag").eq("user_id", userId),
        supabase.from("user_frames").select("frame").eq("user_id", userId),
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", userId),
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", userId),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .or(`user_a.eq.${userId},user_b.eq.${userId}`),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("reported_id", userId),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      if (cancelled) return;

      setDetail({
        profile: (profileRes.data as Profile | null) ?? null,
        listings: (listingsRes.data ?? []) as ListingRow[],
        reviews: (reviewsRes.data ?? []) as ReviewRow[],
        tags: ((tagsRes.data ?? []) as { tag: string }[]).map((row) => row.tag),
        frames: ((framesRes.data ?? []) as { frame: string }[]).map((row) => row.frame),
        salesAsSeller: sellerSalesRes.count ?? 0,
        salesAsBuyer: buyerSalesRes.count ?? 0,
        conversations: conversationsRes.count ?? 0,
        reports: reportsRes.count ?? 0,
        tickets: ticketsRes.count ?? 0,
      });
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const profile = detail?.profile;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Kapat"
      />

      <div className="animate-pop relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">Kullanıcı Verileri</h2>
            <p className="mt-0.5 truncate text-[0.72rem] text-muted-2">{profile?.email ?? "—"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-2 hover:bg-white/5 hover:text-text"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        {loading && <p className="py-10 text-center text-sm text-muted-2">Yükleniyor…</p>}

        {!loading && !profile && (
          <p className="py-10 text-center text-sm text-muted-2">Kullanıcı bulunamadı.</p>
        )}

        {!loading && profile && detail && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-line-soft bg-white/3 p-3">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                <span className="truncate">@{profile.username}</span>
                {profile.verified_seller && <VerifiedBadge small />}
                {detail.tags
                  .filter((tag) => tag === "vip" || tag === "premium")
                  .map((tag) => (
                    <TagBadge key={tag} tag={tag} small />
                  ))}
                {profile.staff_tag && <StaffBadge tag={profile.staff_tag} small />}
                {profile.banned && (
                  <span className="badge border border-danger/40 bg-danger/10 text-[0.55rem] text-danger">
                    BANLI
                  </span>
                )}
              </p>
              <p className="mt-1 break-all text-[0.68rem] text-muted-2">ID: {profile.id}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[0.7rem] sm:grid-cols-3">
                <Info label="Kayıt" value={new Date(profile.created_at).toLocaleDateString("tr-TR")} />
                <Info
                  label="Son görülme"
                  value={
                    profile.last_seen_at
                      ? new Date(profile.last_seen_at).toLocaleString("tr-TR")
                      : "—"
                  }
                />
                <Info label="Başarılı işlem" value={String(profile.sales_count ?? 0)} />
                <Info
                  label="Puan"
                  value={
                    (profile.review_count ?? 0) > 0
                      ? `${Number(profile.rating ?? 0).toFixed(1)} (${profile.review_count})`
                      : "Değerlendirme yok"
                  }
                />
                <Info label="Çerçeve" value={findFrame(profile.equipped_frame).name} />
                <Info label="Durum" value={profile.banned ? "Kısıtlı" : "Aktif"} />
              </div>
              {profile.bio && (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/25 p-2 text-[0.72rem] leading-relaxed text-muted">
                  {profile.bio}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Counter label="İlan" value={detail.listings.length} />
              <Counter label="Satış (satıcı)" value={detail.salesAsSeller} />
              <Counter label="Alım" value={detail.salesAsBuyer} />
              <Counter label="Sohbet" value={detail.conversations} />
              <Counter label="Değerlendirme" value={detail.reviews.length} />
              <Counter label="Şikayet" value={detail.reports} />
              <Counter label="Destek" value={detail.tickets} />
              <Counter label="Etiket" value={detail.tags.length + detail.frames.length} />
            </div>

            <Section title={`İlanları (${detail.listings.length})`}>
              {detail.listings.length === 0 && <Empty text="İlanı yok." />}
              {detail.listings.slice(0, 10).map((listing) => (
                <div key={listing.id} className="flex items-center gap-2 py-1.5">
                  <Link
                    href={`/ilan/goruntule?id=${listing.id}`}
                    className="min-w-0 flex-1 truncate text-[0.75rem] hover:text-accent"
                  >
                    {listing.title}
                  </Link>
                  <span className="shrink-0 text-[0.68rem] text-muted-2">
                    {formatPrice(Number(listing.price))}
                  </span>
                  <span className="shrink-0 text-[0.6rem] text-muted-2">{listing.status}</span>
                </div>
              ))}
            </Section>

            <Section title={`Etiketler (${detail.tags.length})`}>
              {detail.tags.length === 0 ? (
                <Empty text="Etiket yok." />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-line bg-white/4 px-2 py-0.5 text-[0.65rem] text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title={`Verilen çerçeveler (${detail.frames.length})`}>
              {detail.frames.length === 0 ? (
                <Empty text="Özel çerçeve verilmemiş." />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.frames.map((frame) => (
                    <span
                      key={frame}
                      className="rounded-md border border-line bg-white/4 px-2 py-0.5 text-[0.65rem] text-muted"
                    >
                      {findFrame(frame).name}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title={`Değerlendirmeler (${detail.reviews.length})`}>
              {detail.reviews.length === 0 && <Empty text="Değerlendirme yok." />}
              {detail.reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="border-b border-line-soft py-1.5 last:border-0">
                  <p className="text-[0.7rem] font-semibold text-accent">{review.overall}/5</p>
                  {review.comment && (
                    <p className="text-[0.72rem] text-muted">{review.comment}</p>
                  )}
                </div>
              ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/25 px-2 py-1.5">
      <p className="text-[0.58rem] text-muted-2">{label}</p>
      <p className="truncate text-[0.7rem] font-medium text-text">{value}</p>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line-soft bg-white/3 px-2 py-1.5 text-center">
      <p className="text-sm font-extrabold text-text">{value}</p>
      <p className="text-[0.56rem] leading-tight text-muted-2">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line-soft bg-white/3 p-3">
      <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[0.72rem] text-muted-2">{text}</p>;
}
