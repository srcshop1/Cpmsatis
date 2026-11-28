"use client";

import Link from "next/link";
import { CheckIcon, StarIcon } from "@/components/icons";
import { FramedAvatar, StaffBadge, VerifiedTick } from "@/components/user-badge";
import { useState } from "react";
import { categoryLabel, discountOf, isFeatured, type Listing } from "@/lib/listings";
import { Price } from "@/components/price";

export function ListingCard({
  listing,
  picked = false,
  revealIndex,
}: {
  listing: Listing;
  picked?: boolean;
  revealIndex?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const cover = listing.images?.[0];
  const seller = listing.seller;
  const categories =
    listing.categories && listing.categories.length > 0
      ? listing.categories
      : [listing.category];

  return (
    <Link
      href={`/ilan/goruntule?id=${listing.id}`}
      className={`card card-hover group flex flex-col overflow-hidden ${
        isFeatured(listing) ? "card-featured" : ""
      } ${picked ? "card-pick" : ""} ${revealIndex !== undefined ? "reveal" : ""}`}
      style={revealIndex !== undefined ? { animationDelay: `${Math.min(revealIndex, 12) * 35}ms` } : undefined}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={listing.title}
            className={`img-fade h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${
              loaded ? "loaded" : ""
            }`}
            onLoad={() => setLoaded(true)}
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl text-muted-2">🖼️</div>
        )}

        <span className="absolute left-2 top-2 flex max-w-[75%] flex-wrap gap-1">
          {categories.slice(0, 2).map((slug) => (
            <span
              key={slug}
              className="badge border border-black/30 bg-black/65 text-[0.6rem] text-white backdrop-blur"
            >
              {categoryLabel(slug)}
            </span>
          ))}
          {categories.length > 2 && (
            <span className="badge border border-black/30 bg-black/65 text-[0.6rem] text-white backdrop-blur">
              +{categories.length - 2}
            </span>
          )}
        </span>

        {(() => {
          const discount = discountOf(listing);
          if (!discount) return null;
          return (
            <span className="absolute bottom-2 left-2 badge border border-mint/50 bg-mint/85 text-[0.55rem] font-bold text-ink">
              %{discount.percent} İNDİRİM
            </span>
          );
        })()}

        {picked && (
          <span className="absolute right-2 top-2 badge border border-white/25 bg-black/70 text-[0.55rem] font-bold uppercase tracking-wide text-white backdrop-blur">
            ✦ Vitrin
          </span>
        )}

        {isFeatured(listing) && (
          <span className="absolute right-2 top-2 badge border border-[#93c5fd]/50 bg-[#2563eb] text-[0.62rem] font-bold text-white">
            <StarIcon width={10} height={10} /> ÖNE ÇIKAN
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.4rem] text-[0.85rem] font-semibold leading-snug">
          {listing.title}
        </h3>

        <p className="mt-2 text-[1rem] font-extrabold text-accent">
          <Price value={listing.price} iconSize={14} />
        </p>

        <div className="mt-2 border-t border-line-soft/70 pt-2 text-[0.68rem] text-muted-2">
          <div className="flex items-center gap-1.5">
            <FramedAvatar
              src={seller?.avatar_url}
              username={seller?.username}
              frame={seller?.equipped_frame}
              size={22}
              rounded="rounded-md"
            />
            <span className="min-w-0 flex-1 truncate text-[0.74rem] font-semibold text-text">
              @{seller?.username ?? "satıcı"}
            </span>
            {seller?.verified_seller && <VerifiedTick size={12} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {seller?.staff_tag && <StaffBadge tag={seller.staff_tag} small />}
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-mint">
              <CheckIcon width={11} height={11} />
              {seller?.sales_count ?? 0} işlem
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
