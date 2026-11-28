"use client";

import { useEffect, useMemo, useState } from "react";
import { SparkIcon } from "@/components/icons";
import { ListingCard } from "@/components/listing-card";
import { loadStaffShowcase } from "@/lib/showcase";
import type { Listing } from "@/lib/listings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Yetkili vitrini: kurucunun bu hafta seçtiği en fazla 3 ilan.
 * Seçim yoksa hiç görünmez.
 */
export function StaffShowcase() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const rows = await loadStaffShowcase(supabase);
      if (!cancelled) setListings(rows);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (listings.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="card relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-accent/12 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent/35 bg-accent/12 text-accent">
            <SparkIcon width={16} height={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Yetkili Vitrini</h2>
            <p className="mt-0.5 text-[0.72rem] text-muted-2">
              Bu hafta yetkililerin seçtiği ilanlar
            </p>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>
    </section>
  );
}
