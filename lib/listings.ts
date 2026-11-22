"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findCategory } from "@/lib/catalog";

export type ListingSeller = {
  id: string;
  username: string;
  avatar_url: string | null;
  sales_count: number | null;
  rating: number | null;
  review_count: number | null;
  verified_seller: boolean | null;
  staff_tag: string | null;
  equipped_frame: string | null;
  last_seen_at: string | null;
};

export type Listing = {
  id: string;
  title: string;
  price: number;
  category: string;
  categories: string[] | null;
  images: string[];
  featured_until: string | null;
  created_at: string;
  seller_id: string;
  view_count?: number | null;
  favorite_count?: number | null;
  previous_price?: number | null;
  price_dropped_at?: string | null;
  seller: ListingSeller | null;
};

export type ListingFilters = {
  query: string;
  categories: string[];
  min: number | null;
  max: number | null;
  onlineOnly: boolean;
  deals10: boolean;
  verifiedOnly: boolean;
};

export const LISTINGS_TABLE = "listings";
/** İlan yayında kalma süresi (gün) */
export const LISTING_LIFETIME_DAYS = 15;
export const LISTING_IMAGES_BUCKET = "listing-images";

const LISTING_COLUMNS =
  "id,title,price,category,categories,images,featured_until,created_at,seller_id,view_count,favorite_count,previous_price,price_dropped_at";

export function isFeatured(listing: Listing) {
  return Boolean(listing.featured_until && new Date(listing.featured_until) > new Date());
}

export function categoryLabel(slug: string) {
  return findCategory(slug)?.short ?? slug;
}

export function listingExpiresAt(createdAt: string) {
  return new Date(new Date(createdAt).getTime() + LISTING_LIFETIME_DAYS * 86400000);
}

export function daysLeft(createdAt: string) {
  const ms = listingExpiresAt(createdAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function isExpired(createdAt: string) {
  return Date.now() > listingExpiresAt(createdAt).getTime();
}

/** Süresi dolan ilanları gizler (veritabanı fonksiyonu varsa) */
export async function expireListings(supabase: SupabaseClient) {
  await supabase.rpc("expire_listings");
}

/** Kendi ilanını 15 gün daha yayında tutar */
export async function renewListing(supabase: SupabaseClient, listingId: string) {
  const { error } = await supabase.rpc("renew_listing", { p_listing: listingId });
  if (error) {
    // fonksiyon yoksa doğrudan güncelle (RLS sahibine izin verir)
    return supabase
      .from(LISTINGS_TABLE)
      .update({ created_at: new Date().toISOString(), status: "active" })
      .eq("id", listingId);
  }
  return { error: null };
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
    request = request.overlaps("categories", filters.categories);
  }
  if (filters.min !== null) request = request.gte("price", filters.min);
  if (filters.max !== null) request = request.lte("price", filters.max);

  let { data, error } = await request as { data: unknown[] | null; error: { message: string } | null };

  // categories kolonu henüz yoksa eski tek kategori alanıyla devam et
  if (error && /categories|column|schema cache/i.test(error.message)) {
    let retry = supabase
      .from(LISTINGS_TABLE)
      .select("id,title,price,category,images,featured_until,created_at,seller_id")
      .eq("status", "active")
      .order("featured_until", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(120);
    if (filters.categories.length > 0) retry = retry.in("category", filters.categories);
    if (filters.min !== null) retry = retry.gte("price", filters.min);
    if (filters.max !== null) retry = retry.lte("price", filters.max);
    const second = await retry;
    data = second.data as unknown[] | null;
    error = second.error;
  }

  if (error) {
    return { listings: [], error: error.message };
  }

  const rows = (data ?? []) as unknown as Omit<Listing, "seller">[];
  const sellerIds = Array.from(new Set(rows.map((row) => row.seller_id)));

  const sellers = new Map<string, ListingSeller>();
  if (sellerIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, sales_count, rating, review_count, verified_seller, staff_tag, equipped_frame, last_seen_at")
      .in("id", sellerIds);

    let rowsToUse = (profileRows ?? []) as unknown as ListingSeller[];
    if (profileError) {
      const retry = await supabase
        .from("profiles")
        .select("id, username, avatar_url, sales_count, rating, review_count, verified_seller, last_seen_at")
        .in("id", sellerIds);
      rowsToUse = (retry.data ?? []) as unknown as ListingSeller[];
    }

    for (const profile of rowsToUse) {
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
      if (isExpired(listing.created_at)) return false;
      if (filters.verifiedOnly && !listing.seller?.verified_seller) return false;
      if (filters.onlineOnly && !isSellerOnline(listing.seller)) return false;
      if (filters.deals10 && (listing.seller?.sales_count ?? 0) < 10) return false;
      return true;
    });

  // Sıralama: öne çıkan > onaylı satıcı > normal ilan
  const ranked = [...listings].sort((a, b) => {
    const score = (listing: Listing) =>
      (isFeatured(listing) ? 2 : 0) + (listing.seller?.verified_seller ? 1 : 0);
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { listings: ranked, error: null };
}

export async function touchLastSeen(supabase: SupabaseClient, userId: string) {
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}

/** İlanın görüntülenme ve favori sayısını getirir. */
export async function loadListingCounters(
  supabase: SupabaseClient,
  listingId: string,
): Promise<{ views: number; favorites: number }> {
  const { data, error } = await supabase
    .from(LISTINGS_TABLE)
    .select("view_count,favorite_count")
    .eq("id", listingId)
    .maybeSingle();

  if (error || !data) return { views: 0, favorites: 0 };
  const row = data as unknown as { view_count?: number | null; favorite_count?: number | null };
  return { views: Number(row.view_count ?? 0), favorites: Number(row.favorite_count ?? 0) };
}

/** Görüntülenmeyi bir kez sayar (aynı kişi 6 saatte bir). */
export async function registerListingView(
  supabase: SupabaseClient,
  listingId: string,
): Promise<number | null> {
  const key = `cpmsatis:view:${listingId}`;
  try {
    const last = Number(window.localStorage.getItem(key) ?? 0);
    if (last && Date.now() - last < 6 * 60 * 60 * 1000) return null;
  } catch {
    // localStorage kapalıysa sayaç yine çalışsın
  }

  const { data, error } = await supabase.rpc("increment_listing_view", {
    p_listing: listingId,
  });
  if (error) return null;

  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // yoksay
  }
  return Number(data ?? 0);
}

/** Kullanıcının bu ilanı favorileyip favorilemediği. */
export async function isListingFavorited(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("listing_favorites")
    .select("listing_id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();
  return Boolean(data);
}

/** Favoriye ekler / çıkarır. */
export async function toggleListingFavorite(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<{ favorited: boolean | null; error: string | null }> {
  const { data, error } = await supabase.rpc("toggle_listing_favorite", {
    p_listing: listingId,
  });
  if (!error) return { favorited: Boolean(data), error: null };

  // Fonksiyon kurulmamışsa tabloya doğrudan yaz
  if (/could not find the function|schema cache|does not exist/i.test(error.message)) {
    const existing = await supabase
      .from("listing_favorites")
      .select("listing_id")
      .eq("user_id", userId)
      .eq("listing_id", listingId)
      .maybeSingle();

    if (existing.data) {
      const removed = await supabase
        .from("listing_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("listing_id", listingId);
      return removed.error ? { favorited: null, error: "Favori kaldırılamadı." } : { favorited: false, error: null };
    }

    const added = await supabase
      .from("listing_favorites")
      .insert({ user_id: userId, listing_id: listingId });
    return added.error ? { favorited: null, error: "Favoriye eklenemedi." } : { favorited: true, error: null };
  }

  return { favorited: null, error: "Favori kaydedilemedi." };
}

/** Benzer ilanlar: aynı kategoriden, kendisi ve satıcısı hariç. */
export async function loadRelatedListings(
  supabase: SupabaseClient,
  input: { categories: string[]; excludeId: string; sellerId: string; limit?: number },
): Promise<Listing[]> {
  const limit = input.limit ?? 6;
  let request = supabase
    .from(LISTINGS_TABLE)
    .select(LISTING_COLUMNS)
    .eq("status", "active")
    .neq("id", input.excludeId)
    .neq("seller_id", input.sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.categories.length > 0) request = request.overlaps("categories", input.categories);

  const { data, error } = await request;
  if (error) return [];
  return attachSellers(supabase, (data ?? []) as unknown as Omit<Listing, "seller">[]);
}

/** Satıcının diğer ilanları. */
export async function loadSellerListings(
  supabase: SupabaseClient,
  input: { sellerId: string; excludeId?: string; limit?: number },
): Promise<Listing[]> {
  const limit = input.limit ?? 12;
  let request = supabase
    .from(LISTINGS_TABLE)
    .select(LISTING_COLUMNS)
    .eq("status", "active")
    .eq("seller_id", input.sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.excludeId) request = request.neq("id", input.excludeId);

  const { data, error } = await request;
  if (error) return [];
  return attachSellers(supabase, (data ?? []) as unknown as Omit<Listing, "seller">[]);
}

async function attachSellers(
  supabase: SupabaseClient,
  rows: Omit<Listing, "seller">[],
): Promise<Listing[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((row) => row.seller_id)));
  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, sales_count, rating, review_count, verified_seller, staff_tag, equipped_frame, last_seen_at")
    .in("id", ids);

  const sellers = new Map<string, ListingSeller>();
  for (const profile of (data ?? []) as unknown as ListingSeller[]) {
    sellers.set(profile.id, profile);
  }
  return rows.map((row) => ({ ...row, seller: sellers.get(row.seller_id) ?? null }));
}

/** Kullanıcının favorilediği ilanlar (favori sırasına göre). */
export async function loadFavoriteListings(
  supabase: SupabaseClient,
  userId: string,
  limit = 60,
): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listing_favorites")
    .select("listing_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  const ids = (data as { listing_id: string }[]).map((row) => row.listing_id);
  if (ids.length === 0) return [];

  const { data: rows, error: rowsError } = await supabase
    .from(LISTINGS_TABLE)
    .select(LISTING_COLUMNS)
    .in("id", ids);

  if (rowsError || !rows) return [];

  const listings = await attachSellers(
    supabase,
    rows as unknown as Omit<Listing, "seller">[],
  );
  const order = new Map(ids.map((id, index) => [id, index]));
  return listings.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Favoriden çıkarır. */
export async function removeFavorite(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("listing_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", listingId);
  if (!error) return true;

  const fallback = await toggleListingFavorite(supabase, userId, listingId);
  return fallback.error === null;
}

/** İlan indirimde mi? Orijinal fiyat + indirim oranı. */
export function discountOf(listing: { previous_price?: number | null; price: number }) {
  const original = Number(listing.previous_price ?? 0);
  if (!original || original <= listing.price) return null;
  const amount = original - listing.price;
  const percent = Math.max(1, Math.round((amount / original) * 100));
  return { original, amount, percent };
}

export type DiscountQuota = { limit: number; used: number; remaining: number | null };

/** Bu ayki indirim hakkı (limit -1 ise sınırsız). */
export async function loadDiscountQuota(
  supabase: SupabaseClient,
): Promise<DiscountQuota | null> {
  const { data, error } = await supabase.rpc("my_discount_usage");
  if (error || !data) return null;
  const row = data as { limit?: number; used?: number; remaining?: number | null };
  return {
    limit: Number(row.limit ?? 0),
    used: Number(row.used ?? 0),
    remaining: row.remaining === null || row.remaining === undefined ? null : Number(row.remaining),
  };
}

/** İndirim uygular, kalan hakkı döner. */
export async function applyDiscount(
  supabase: SupabaseClient,
  listingId: string,
  price: number,
): Promise<{ quota: DiscountQuota | null; error: string | null }> {
  const { data, error } = await supabase.rpc("apply_listing_discount", {
    p_listing: listingId,
    p_price: price,
  });
  if (error) {
    const message = /hakkın doldu|doldu/i.test(error.message)
      ? "Bu ayki indirim hakkın doldu."
      : /küçük|düşük|eski fiyattan/i.test(error.message)
        ? "İndirimli fiyat, mevcut fiyattan düşük olmalı."
        : "İndirim uygulanamadı.";
    return { quota: null, error: message };
  }
  const row = data as { limit?: number; used?: number; remaining?: number | null };
  return {
    quota: {
      limit: Number(row.limit ?? 0),
      used: Number(row.used ?? 0),
      remaining:
        row.remaining === null || row.remaining === undefined ? null : Number(row.remaining),
    },
    error: null,
  };
}

/** İndirimi geri alır (fiyat eski haline döner). */
export async function cancelDiscount(
  supabase: SupabaseClient,
  listingId: string,
): Promise<string | null> {
  const { error } = await supabase.rpc("cancel_listing_discount", { p_listing: listingId });
  return error ? "İndirim kaldırılamadı." : null;
}

/** Satıcının ortalama yanıt süresi (dakika). */
export async function loadResponseMinutes(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("seller_response_minutes", { p_user: userId });
  if (error || data === null || data === undefined) return null;
  const value = Number(data);
  return Number.isFinite(value) ? value : null;
}

/** "2 gün", "3 saat", "25 dk" gibi kısa süre metni. */
export function responseLabel(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) return null;
  if (minutes <= 5) return "5 dakikadan kısa sürede yanıtlar";
  if (minutes < 60) return `ortalama ${Math.round(minutes)} dk içinde yanıtlar`;
  if (minutes < 60 * 24) return `ortalama ${Math.round(minutes / 60)} saat içinde yanıtlar`;
  return `ortalama ${Math.round(minutes / (60 * 24))} gün içinde yanıtlar`;
}
