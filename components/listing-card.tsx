"use client";

import Link from "next/link";
import { CheckIcon, StarIcon } from "@/components/icons";
import { categoryLabel, isFeatured, type Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/catalog";

export function ListingCard({ listing }: { listing: Listing }) {
  const cover = listing.images?.[0];
  const seller = listing.seller;

  return (
    <Link
      href={`/ilan/${listing.id}`}
      className="card card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={listing.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl text-muted-2">🖼️</div>
        )}

        <span className="absolute left-2 top-2 badge border border-black/30 bg-black/60 text-[0.62rem] text-white backdrop-blur">
          {categoryLabel(listing.category)}
        </span>

        {isFeatured(listing) && (
          <span className="absolute right-2 top-2 badge border border-accent/40 bg-accent/90 text-[0.62rem] font-bold text-ink">
            <StarIcon width={10} height={10} /> ÖNE ÇIKAN
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.4rem] text-[0.85rem] font-semibold leading-snug">
          {listing.title}
        </h3>

        <p className="mt-2 text-[1rem] font-extrabold text-accent">{formatPrice(listing.price)}</p>

        <div className="mt-2 flex items-center gap-1.5 border-t border-line-soft/70 pt-2 text-[0.68rem] text-muted-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-md bg-white/8 text-[0.58rem] font-bold text-muted">
            {seller?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (seller?.username ?? "?").charAt(0).toUpperCase()
            )}
          </span>
          <span className="truncate">@{seller?.username ?? "satıcı"}</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-mint">
            <CheckIcon width={11} height={11} />
            {seller?.sales_count ?? 0} işlem
          </span>
        </div>
      </div>
    </Link>
  );
}
