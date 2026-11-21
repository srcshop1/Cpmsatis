import { BoltIcon } from "@/components/icons";
import { formatPrice, type DemoListing } from "@/lib/catalog";

export function ListingCard({ listing }: { listing: DemoListing }) {
  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <div className="relative flex h-28 items-center justify-center border-b border-line-soft/70 bg-[radial-gradient(120%_120%_at_50%_-20%,rgba(255,138,31,0.16),transparent_60%)]">
        <span className="text-[2.1rem] transition-transform duration-300 group-hover:scale-110" aria-hidden>
          {listing.icon}
        </span>
        <span className="absolute left-2.5 top-2.5 badge border border-line bg-black/40 text-[0.65rem] text-muted">
          {listing.category}
        </span>
        <span className="absolute right-2.5 top-2.5 badge border border-mint/25 bg-mint/10 text-[0.65rem] text-mint">
          <BoltIcon width={10} height={10} /> {listing.delivery}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-[0.9rem] font-semibold leading-snug text-text">
          {listing.title}
        </h3>

        <div className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-muted-2">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-white/6 text-[0.6rem] font-bold text-muted">
            {listing.seller.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">@{listing.seller}</span>
          <span className="text-accent">★ {listing.rating.toFixed(1)}</span>
          <span className="ml-auto shrink-0">{listing.sales} satış</span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-line-soft/70 pt-3">
          <div>
            <p className="text-[0.62rem] uppercase tracking-wider text-muted-2">Fiyat</p>
            <p className="text-[1.02rem] font-bold text-text">{formatPrice(listing.price)}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary h-8 rounded-lg px-3 text-[0.78rem]"
            title="Satın alma akışı sonraki adımda eklenecek"
          >
            Satın Al
          </button>
        </div>
      </div>
    </article>
  );
}
