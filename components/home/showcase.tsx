"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, CheckIcon, StarIcon } from "@/components/icons";
import { ListingCard } from "@/components/listing-card";
import { FramedAvatar, StaffBadge, VerifiedTick } from "@/components/user-badge";
import { fetchListings, isFeatured, type Listing, type ListingSeller } from "@/lib/listings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Seller = ListingSeller & { username: string };

const emptyFilters = {
  query: "",
  categories: [],
  min: null,
  max: null,
  onlineOnly: false,
  deals10: false,
  verifiedOnly: false,
};

export function HomeShowcase() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [listings, setListings] = useState<Listing[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    void (async () => {
      const [{ listings: rows }, sellerRes] = await Promise.all([
        fetchListings(supabase, emptyFilters),
        supabase
          .from("profiles")
          .select(
            "id, username, avatar_url, sales_count, rating, review_count, verified_seller, staff_tag, equipped_frame, last_seen_at",
          )
          .order("sales_count", { ascending: false })
          .limit(6),
      ]);

      if (cancelled) return;
      setListings(rows);
      setSellers((sellerRes.data ?? []) as unknown as Seller[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const featured = listings.filter((listing) => isFeatured(listing)).slice(0, 3);
  const latest = listings.slice(0, 8);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="h-5 w-40 animate-pulse rounded bg-white/6" />
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-52 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </section>
    );
  }

  if (listings.length === 0) return null;

  return (
    <>
      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight sm:text-xl">
                <StarIcon width={17} height={17} className="text-[#93c5fd]" /> Öne çıkanlar
              </h2>
              <p className="mt-0.5 text-[0.72rem] text-muted-2">Yetkili onayıyla vitrine çıkan ilanlar</p>
            </div>
            <Link
              href="/ilanlar"
              className="inline-flex shrink-0 items-center gap-1 text-[0.72rem] font-semibold text-accent hover:underline"
            >
              Tümü <ArrowRightIcon width={12} height={12} />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Son eklenenler</h2>
            <p className="mt-0.5 text-[0.72rem] text-muted-2">
              Onaylı satıcılar ve öne çıkan ilanlar üstte
            </p>
          </div>
          <Link
            href="/ilanlar"
            className="inline-flex shrink-0 items-center gap-1 text-[0.72rem] font-semibold text-accent hover:underline"
          >
            Tüm ilanlar <ArrowRightIcon width={12} height={12} />
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {latest.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {sellers.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-8">
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Popüler satıcılar</h2>
          <p className="mt-0.5 text-[0.72rem] text-muted-2">En çok işlem yapan satıcılar</p>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                href={`/satici?id=${seller.id}`}
                className="card card-hover flex items-center gap-2.5 p-3"
              >
                <FramedAvatar
                  src={seller.avatar_url}
                  username={seller.username}
                  frame={seller.equipped_frame}
                  size={38}
                  rounded="rounded-xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="min-w-0 truncate text-[0.8rem] font-semibold">
                      @{seller.username}
                    </span>
                    {seller.verified_seller && <VerifiedTick size={12} />}
                    {seller.staff_tag && <StaffBadge tag={seller.staff_tag} small />}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.62rem] text-muted-2">
                    <span className="inline-flex items-center gap-0.5 text-mint">
                      <CheckIcon width={10} height={10} /> {seller.sales_count ?? 0} işlem
                    </span>
                    {(seller.review_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <StarIcon width={10} height={10} className="text-accent" />
                        {Number(seller.rating ?? 0).toFixed(1)} ({seller.review_count})
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
