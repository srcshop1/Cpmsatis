"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SaleStatus = "pending_buyer" | "confirmed" | "approved" | "declined" | "cancelled";

export type Sale = {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  status: SaleStatus;
  auto_approve_at: string;
  buyer_confirmed_at: string | null;
  approved_at: string | null;
  created_at: string;
  listing?: { id: string; title: string; images: string[] | null; price: number } | null;
  review?: Review | null;
  seller?: { username: string } | null;
  buyer?: { username: string } | null;
};

export type Review = {
  id: string;
  sale_id: string | null;
  listing_id: string | null;
  seller_id: string;
  buyer_id: string;
  satisfaction: number;
  trust: number;
  communication: number;
  delivery: number;
  overall: number;
  comment: string | null;
  created_at: string;
  reviewer?: { username: string; avatar_url: string | null } | null;
};

export type ReviewAverages = {
  satisfaction: number;
  trust: number;
  communication: number;
  delivery: number;
  overall: number;
  count: number;
};

export const EMPTY_AVERAGES: ReviewAverages = {
  satisfaction: 0,
  trust: 0,
  communication: 0,
  delivery: 0,
  overall: 0,
  count: 0,
};

export function averageReviews(reviews: Review[]): ReviewAverages {
  if (reviews.length === 0) return EMPTY_AVERAGES;
  const sum = (key: keyof Pick<Review, "satisfaction" | "trust" | "communication" | "delivery" | "overall">) =>
    reviews.reduce((total, review) => total + Number(review[key] ?? 0), 0);

  return {
    satisfaction: sum("satisfaction") / reviews.length,
    trust: sum("trust") / reviews.length,
    communication: sum("communication") / reviews.length,
    delivery: sum("delivery") / reviews.length,
    overall: sum("overall") / reviews.length,
    count: reviews.length,
  };
}

const REVIEW_COLUMNS =
  "id, sale_id, listing_id, seller_id, buyer_id, satisfaction, trust, communication, delivery, overall, comment, created_at";

export async function resolveSales(supabase: SupabaseClient) {
  await supabase.rpc("resolve_sales");
}

export async function loadSales(supabase: SupabaseClient, userId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, listing_id, seller_id, buyer_id, status, auto_approve_at, buyer_confirmed_at, approved_at, created_at",
    )
    .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  const rows = data as Sale[];

  const listingIds = Array.from(new Set(rows.map((row) => row.listing_id)));
  const listings = new Map<string, NonNullable<Sale["listing"]>>();
  if (listingIds.length > 0) {
    const { data: listingRows } = await supabase
      .from("listings")
      .select("id, title, images, price")
      .in("id", listingIds);
    for (const listing of (listingRows ?? []) as NonNullable<Sale["listing"]>[]) {
      listings.set(listing.id, listing);
    }
  }

  const saleIds = rows.map((row) => row.id);
  const reviews = new Map<string, Review>();
  if (saleIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from("reviews")
      .select(REVIEW_COLUMNS)
      .in("sale_id", saleIds);
    for (const review of (reviewRows ?? []) as Review[]) {
      if (review.sale_id) reviews.set(review.sale_id, review);
    }
  }

  return rows.map((row) => ({
    ...row,
    listing: listings.get(row.listing_id) ?? null,
    review: reviews.get(row.id) ?? null,
  }));
}

export async function loadSale(
  supabase: SupabaseClient,
  saleId: string,
): Promise<Sale | null> {
  const { data } = await supabase
    .from("sales")
    .select(
      "id, listing_id, seller_id, buyer_id, status, auto_approve_at, buyer_confirmed_at, approved_at, created_at",
    )
    .eq("id", saleId)
    .maybeSingle();
  if (!data) return null;
  const sale = data as Sale;

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, images, price")
    .eq("id", sale.listing_id)
    .maybeSingle();

  const { data: review } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("sale_id", saleId)
    .maybeSingle();

  return {
    ...sale,
    listing: (listing as Sale["listing"]) ?? null,
    review: (review as Review | null) ?? null,
  };
}

export async function loadReviews(
  supabase: SupabaseClient,
  filter: { sellerId?: string; listingId?: string },
  limit = 30,
): Promise<Review[]> {
  let request = supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.sellerId) request = request.eq("seller_id", filter.sellerId);
  if (filter.listingId) request = request.eq("listing_id", filter.listingId);

  const { data } = await request;
  const reviews = (data ?? []) as Review[];
  if (reviews.length === 0) return reviews;

  const buyerIds = Array.from(new Set(reviews.map((review) => review.buyer_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", buyerIds);
  const map = new Map(
    ((profiles ?? []) as { id: string; username: string; avatar_url: string | null }[]).map(
      (profile) => [profile.id, profile],
    ),
  );

  return reviews.map((review) => ({
    ...review,
    reviewer: map.get(review.buyer_id) ?? null,
  }));
}

export async function createReview(
  supabase: SupabaseClient,
  input: {
    saleId: string;
    listingId: string;
    sellerId: string;
    buyerId: string;
    satisfaction: number;
    trust: number;
    communication: number;
    delivery: number;
    overall: number;
    comment: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("reviews").insert({
    sale_id: input.saleId,
    listing_id: input.listingId,
    seller_id: input.sellerId,
    buyer_id: input.buyerId,
    satisfaction: input.satisfaction,
    trust: input.trust,
    communication: input.communication,
    delivery: input.delivery,
    overall: input.overall,
    comment: input.comment.trim() || null,
  });
  return { error: error?.message ?? null };
}
