"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadListingsByIds, type Listing } from "@/lib/listings";

export const SHOWCASE_MAX = 3;

/**
 * Bu haftanın yetkili vitrini.
 * Kurucu seçim yapmadıysa boş dizi döner ve vitrin hiç gösterilmez.
 */
export async function loadStaffShowcase(supabase: SupabaseClient): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("staff_showcase_current")
    .select("position, listing_id")
    .order("position", { ascending: true });

  if (error) return [];

  const rows = (data ?? []) as { position: number; listing_id: string }[];
  if (rows.length === 0) return [];

  return loadListingsByIds(
    supabase,
    rows.map((row) => row.listing_id),
  );
}
