"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { ChevronLeftIcon, HeartIcon } from "@/components/icons";
import { ListingCard } from "@/components/listing-card";
import { loadFavoriteListings, removeFavorite, type Listing } from "@/lib/listings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function FavoritesClient() {
  const { user, loading } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [listings, setListings] = useState<Listing[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!supabase || !user) {
      setListings([]);
      setState("ready");
      return;
    }
    let cancelled = false;

    void loadFavoriteListings(supabase, user.id).then((rows) => {
      if (cancelled) return;
      setListings(rows);
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, user, loading]);

  async function drop(listingId: string) {
    if (!supabase || !user || removing) return;
    setRemoving(listingId);
    const ok = await removeFavorite(supabase, user.id, listingId);
    setRemoving(null);
    if (ok) setListings((prev) => prev.filter((item) => item.id !== listingId));
  }

  return (
    <AppShell>
      <Link
        href="/ilanlar"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> İlanlar
      </Link>

      <h1 className="mt-3 flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl">
        <HeartIcon width={20} height={20} className="text-[#ff9ba5]" filled /> Favorilerim
      </h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">
        Kalp attığın ilanlar burada. İlan kalkarsa listeden düşer.
      </p>

      {!loading && !user && (
        <div className="mt-4 card px-5 py-12 text-center">
          <p className="text-sm font-semibold">Favorilerini görmek için giriş yap</p>
          <p className="mt-1 text-xs text-muted-2">Beğendiğin ilanları kaydet, sonra buradan aç.</p>
          <Link href="/giris" className="btn btn-primary mt-4 h-10 px-5 text-sm">
            Giriş yap
          </Link>
        </div>
      )}

      {state === "loading" && user && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-52 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      )}

      {state === "ready" && user && listings.length === 0 && (
        <div className="mt-4 card px-5 py-12 text-center">
          <p className="text-sm font-semibold">Henüz favorin yok</p>
          <p className="mt-1 text-xs text-muted-2">
            İlan sayfasındaki <span className="font-semibold text-[#ff9ba5]">Favorile</span> butonuna
            bas, burada biriksin.
          </p>
          <Link href="/ilanlar" className="btn btn-primary mt-4 h-10 px-5 text-sm">
            İlanlara göz at
          </Link>
        </div>
      )}

      {state === "ready" && listings.length > 0 && (
        <>
          <p className="mt-3 text-[0.68rem] text-muted-2">{listings.length} ilan</p>
          <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {listings.map((listing) => (
              <div key={listing.id} className="relative">
                <ListingCard listing={listing} />
                <button
                  type="button"
                  onClick={() => void drop(listing.id)}
                  disabled={removing === listing.id}
                  className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full border border-black/40 bg-black/70 text-[#ff9ba5] backdrop-blur transition hover:bg-black/85 disabled:opacity-50"
                  aria-label="Favoriden çıkar"
                  title="Favoriden çıkar"
                >
                  <HeartIcon width={14} height={14} filled />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
