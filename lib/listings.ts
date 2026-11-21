"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findCategory } from "@/lib/catalog";

export type ListingSeller = {
  id: string;
  username: string;
  avatar_url: string | null;
  sales_count: number | null;
  rating: number | null;
  last_seen_at: string | null;
};

export type Listing = {
  id: string;
  title: string;
  price: number;
  category: string;
  images: string[];
  featured_until: string | null;
  created_at: string;
  seller_id: string;
  seller: ListingSeller | null;
};

export type ListingFilters = {
  query: string;
  categories: string[];
  min: number | null;
  max: number | null;
  onlineOnly: boolean;
  deals10: boolean;
};

export const LISTINGS_TABLE = "listings";
export const LISTING_IMAGES_BUCKET = "listing-images";

const LISTING_COLUMNS =
  "id,title,price,category,images,featured_until,created_at,seller_id";

export function isFeatured(listing: Listing) {
  return Boolean(listing.featured_until && new Date(listing.featured_until) > new Date());
}

export function categoryLabel(slug: string) {
  return findCategory(slug)?.short ?? slug;
}

function isSellerOnline(seller: ListingSeller | null) {
  if (!seller?.last_seen_at) return false;
  const diff = Date.now() - new Date(seller.last_seen_at).getTime();
  return diff >= 0 && diff < 5 * 60 * 1000;
}

export async function fetchListings(
  supabase: SupabaseClient,
  filters: ListingFilters,
): Promise<{ listings: Listing[]; error: string | null }> {
  let request = supabase
    .from(LISTINGS_TABLE)
    .select(LISTING_COLUMNS)
    .eq("status", "active")
    .order("featured_until", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(120);

  if (filters.categories.length > 0) {
    request = request.in("category", filters.categories);
  }
  if (filters.min !== null) request = request.gte("price", filters.min);
  if (filters.max !== null) request = request.lte("price", filters.max);

  const { data, error } = await request;

  if (error) {
    return { listings: [], error: error.message };
  }

  const rows = (data ?? []) as Omit<Listing, "seller">[];
  const sellerIds = Array.from(new Set(rows.map((row) => row.seller_id)));

  const sellers = new Map<string, ListingSeller>();
  if (sellerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, sales_count, rating, last_seen_at")
      .in("id", sellerIds);

    for (const profile of (profileRows ?? []) as ListingSeller[]) {
      sellers.set(profile.id, profile);
    }
  }

  const needle = filters.query.toLocaleLowerCase("tr");

  const listings = rows
    .map((row) => ({ ...row, seller: sellers.get(row.seller_id) ?? null }))
    .filter((listing) => {
      if (needle) {
        const haystack = `${listing.title} ${listing.seller?.username ?? ""}`.toLocaleLowerCase(
          "tr",
        );
        if (!haystack.includes(needle)) return false;
      }
      if (filters.onlineOnly && !isSellerOnline(listing.seller)) return false;
      if (filters.deals10 && (listing.seller?.sales_count ?? 0) < 10) return false;
      return true;
    });

  return { listings, error: null };
}

export async function touchLastSeen(supabase: SupabaseClient, userId: string) {
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}
