"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminMember = {
  id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  rating: number | null;
  review_count: number | null;
  sales_count: number | null;
  verified_seller: boolean | null;
  banned: boolean | null;
  created_at: string;
};

export type AdminListingRow = {
  id: string;
  title: string;
  price: number;
  status: string;
  created_at: string;
};

function missingFunction(message: string) {
  return /could not find the function|schema cache|does not exist/i.test(message);
}

/** Değerlendirmeyi kaldırır ve satıcının puanını yeniden hesaplar. */
export async function deleteReviewAsStaff(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_delete_review", { p_review: reviewId });
  if (!error) return { error: null };

  if (missingFunction(error.message)) {
    const fallback = await supabase.from("reviews").delete().eq("id", reviewId);
    if (!fallback.error) return { error: null };
  }

  return { error: "Değerlendirme kaldırılamadı." };
}

/** Kullanıcının aldığı tüm değerlendirmeleri kaldırır. */
export async function clearReviewsAsStaff(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null; removed: number }> {
  const { data, error } = await supabase.rpc("admin_clear_reviews", { p_user: userId });
  if (!error) return { error: null, removed: Number(data ?? 0) };
  return { error: "Değerlendirmeler kaldırılamadı.", removed: 0 };
}

/** Başarılı işlem sayısını elle ayarlar. */
export async function setMemberSalesCount(
  supabase: SupabaseClient,
  userId: string,
  count: number,
): Promise<{ error: string | null; value: number }> {
  const safe = Math.max(0, Math.min(999999, Math.round(Number(count) || 0)));
  const { error } = await supabase.rpc("admin_set_sales_count", {
    p_user: userId,
    p_count: safe,
  });
  if (!error) return { error: null, value: safe };

  if (missingFunction(error.message)) {
    const fallback = await supabase
      .from("profiles")
      .update({ sales_count: safe })
      .eq("id", userId);
    if (!fallback.error) return { error: null, value: safe };
  }

  return { error: "Başarılı işlem sayısı kaydedilemedi.", value: safe };
}

/** Başarılı işlem sayısını onaylanmış satışlardan yeniden hesaplar. */
export async function syncMemberSalesCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null; value: number | null }> {
  const { data, error } = await supabase.rpc("admin_sync_sales_count", { p_user: userId });
  if (!error) return { error: null, value: Number(data ?? 0) };

  if (missingFunction(error.message)) {
    const { count } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", userId)
      .eq("status", "approved");
    const fallback = await supabase
      .from("profiles")
      .update({ sales_count: count ?? 0 })
      .eq("id", userId);
    if (!fallback.error) return { error: null, value: count ?? 0 };
  }

  return { error: "Sayı hesaplanamadı.", value: null };
}

/** Hesabı (giriş hesabı + tüm veriler) kalıcı olarak siler. */
export async function deleteAccountAsStaff(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_delete_account", { p_user: userId });
  if (!error) return { error: null };

  if (/kurucu|kendi hesab/i.test(error.message)) {
    return { error: error.message };
  }

  if (missingFunction(error.message)) {
    const fallback = await supabase.from("profiles").delete().eq("id", userId);
    if (!fallback.error) return { error: null };
  }

  return { error: "Hesap silinemedi." };
}

/** İlanı kaldırır (yetkili). */
export async function deleteListingAsStaff(
  supabase: SupabaseClient,
  listingId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  return { error: error ? "İlan kaldırılamadı." : null };
}

export async function loadAdminMember(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminMember | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, email, avatar_url, rating, review_count, sales_count, verified_seller, banned, created_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    const fallback = await supabase
      .from("profiles")
      .select("id, username, email, avatar_url, rating, review_count, sales_count, verified_seller, created_at")
      .eq("id", userId)
      .maybeSingle();
    return (fallback.data as AdminMember | null) ?? null;
  }

  return data as AdminMember;
}

export async function loadMemberListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminListingRow[]> {
  const { data } = await supabase
    .from("listings")
    .select("id, title, price, status, created_at")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as AdminListingRow[];
}
