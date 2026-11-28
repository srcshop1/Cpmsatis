"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadListingsByIds, type Listing } from "@/lib/listings";

export const SHOWCASE_MAX = 3;

/** Sunucudaki hafta başlangıcı ile aynı olsun diye UTC'ye göre pazartesi (YYYY-MM-DD) */
export function currentWeekStart(): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const shift = (utc.getUTCDay() + 6) % 7; // pazartesi = 0
  utc.setUTCDate(utc.getUTCDate() - shift);
  return utc.toISOString().slice(0, 10);
}

/**
 * Bu haftanın yetkili vitrini.
 * Kurucu seçim yapmadıysa boş dizi döner ve vitrin hiç gösterilmez.
 */
export async function loadStaffShowcase(supabase: SupabaseClient): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("staff_showcase")
    .select("position, listing_id, week_start")
    .eq("week_start", currentWeekStart())
    .order("position", { ascending: true });

  if (error) return [];

  const rows = (data ?? []) as { position: number; listing_id: string }[];
  if (rows.length === 0) return [];

  return loadListingsByIds(
    supabase,
    rows.map((row) => row.listing_id),
  );
}

/** Bu hafta vitrinde olan ilanların id'leri (kartlarda çerçeve için) */
export async function loadShowcaseIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("staff_showcase")
    .select("listing_id")
    .eq("week_start", currentWeekStart());

  if (error) return [];
  return ((data ?? []) as { listing_id: string }[]).map((row) => row.listing_id);
}
