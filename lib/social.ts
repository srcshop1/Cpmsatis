"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileMini = {
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

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  listing_ref: {
    id?: string;
    title?: string;
    price?: number;
    image?: string;
    kind?: string;
  } | null;
  reply_to?: {
    id?: string;
    username?: string;
    body?: string;
    kind?: string;
  } | null;
  read_at?: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  listing_id: string | null;
  user_a: string;
  user_b: string;
  last_message_at: string;
  cleared_at?: string | null;
  blocked?: boolean;
  other?: ProfileMini | null;
  last_message?: Message | null;
};

export const REPORT_REASONS = [
  "Dolandırıcılık / şüpheli işlem",
  "Hakaret veya tehdit",
  "Spam / reklam",
  "Sahte ilan",
  "Uygunsuz içerik",
  "Kişisel bilgi paylaşımı",
  "Yaş / kimlik uygunsuzluğu",
  "Anlaşmaya uymama",
  "Tekrarlayan mesaj",
  "Diğer",
];

export async function myStaffRole(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_staff_role");
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function loadProfileMini(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, ProfileMini>> {
  const map = new Map<string, ProfileMini>();
  if (ids.length === 0) return map;
  const columns =
    "id, username, avatar_url, sales_count, rating, review_count, verified_seller, staff_tag, equipped_frame, last_seen_at";

  let { data, error } = await supabase.from("profiles").select(columns).in("id", ids);

  // v4 kolonları yoksa temel alanlarla devam et
  if (error) {
    const retry = await supabase
      .from("profiles")
      .select("id, username, avatar_url, sales_count, rating, review_count, verified_seller, last_seen_at")
      .in("id", ids);
    data = retry.data as typeof data;
  }
  for (const row of (data ?? []) as ProfileMini[]) map.set(row.id, row);
  return map;
}

export async function loadConversations(
  supabase: SupabaseClient,
  userId: string,
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, listing_id, user_a, user_b, last_message_at")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const rows = data as Conversation[];
  const otherIds = rows.map((row) => (row.user_a === userId ? row.user_b : row.user_a));
  const profiles = await loadProfileMini(supabase, Array.from(new Set(otherIds)));

  const { data: states } = await supabase
    .from("conversation_state")
    .select("conversation_id, cleared_at, blocked")
    .eq("user_id", userId);

  const stateMap = new Map(
    ((states ?? []) as { conversation_id: string; cleared_at: string | null; blocked: boolean }[]).map(
      (state) => [state.conversation_id, state],
    ),
  );

  return rows.map((row) => {
    const otherId = row.user_a === userId ? row.user_b : row.user_a;
    const state = stateMap.get(row.id);
    return {
      ...row,
      other: profiles.get(otherId) ?? null,
      cleared_at: state?.cleared_at ?? null,
      blocked: state?.blocked ?? false,
    };
  });
}

export async function loadMessages(
  supabase: SupabaseClient,
  conversationId: string,
  clearedAt?: string | null,
): Promise<Message[]> {
  const base = "id, conversation_id, sender_id, body, listing_ref, created_at";
  const run = async (columns: string) => {
    let request = supabase
      .from("messages")
      .select(columns)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (clearedAt) request = request.gt("created_at", clearedAt);
    return request;
  };

  // Yeni kolonlar (reply_to / read_at) yoksa kademeli olarak temel alanlara in
  const attempts = [
    "id, conversation_id, sender_id, body, listing_ref, reply_to, read_at, created_at",
    "id, conversation_id, sender_id, body, listing_ref, read_at, created_at",
    "id, conversation_id, sender_id, body, listing_ref, reply_to, created_at",
    base,
  ];

  let data: unknown[] | null = null;
  for (const columns of attempts) {
    const result = await run(columns);
    if (!result.error) {
      data = result.data as unknown[] | null;
      break;
    }
  }

  return ((data ?? []) as Message[]).map((message) => ({
    ...message,
    listing_ref:
      typeof message.listing_ref === "string"
        ? (JSON.parse(message.listing_ref) as Message["listing_ref"])
        : message.listing_ref,
  }));
}

export async function findOrCreateConversation(
  supabase: SupabaseClient,
  input: { listingId: string | null; meId: string; otherId: string },
): Promise<{ conversationId: string | null; error: string | null }> {
  const { listingId, meId, otherId } = input;
  if (meId === otherId) return { conversationId: null, error: "Kendinle sohbet açamazsın." };

  let lookup = supabase
    .from("conversations")
    .select("id")
    .or(
      `and(user_a.eq.${meId},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${meId})`,
    )
    .order("created_at", { ascending: false })
    .limit(1);

  if (listingId) lookup = lookup.eq("listing_id", listingId);

  const { data: existing } = await lookup;
  if (existing && existing.length > 0) {
    return { conversationId: existing[0].id as string, error: null };
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ listing_id: listingId, user_a: meId, user_b: otherId })
    .select("id")
    .single();

  if (error) return { conversationId: null, error: error.message };
  return { conversationId: created.id as string, error: null };
}

/** Karşı tarafın mesajlarını okundu olarak işaretler */
export async function markMessagesRead(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
) {
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);
}

export async function sendMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    senderId: string;
    body: string;
    listingRef?: Message["listing_ref"];
    replyTo?: Message["reply_to"];
  },
): Promise<{ error: string | null }> {
  const body = input.body.trim();
  if (!body) return { error: "Mesaj boş olamaz." };
  if (body.length > 4000) return { error: "Mesaj çok uzun." };

  const payload = {
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    body,
    listing_ref: input.listingRef ?? null,
  };

  let { error } = await supabase
    .from("messages")
    .insert({ ...payload, reply_to: input.replyTo ?? null });

  // Yanıt kolonu yoksa alıntısız gönder
  if (error) {
    const retry = await supabase.from("messages").insert(payload);
    error = retry.error;
  }

  if (error) {
    if (error.code === "42501") return { error: "Bu sohbete mesaj gönderemiyorsun." };
    return { error: error.message };
  }
  return { error: null };
}

export async function saveConversationState(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  patch: { cleared_at?: string; blocked?: boolean },
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from("conversation_state")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("conversation_state")
      .update(patch)
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase
    .from("conversation_state")
    .insert({ conversation_id: conversationId, user_id: userId, ...patch });
  return { error: error?.message ?? null };
}

export async function isConversationBlocked(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("conversation_state")
    .select("blocked")
    .eq("conversation_id", conversationId);
  return ((data ?? []) as { blocked: boolean }[]).some((row) => row.blocked);
}

/** Kullanıcı engelleme (profil üzerinden) */
export async function isUserBlocked(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function isBlockedEitherWay(
  supabase: SupabaseClient,
  a: string,
  b: string,
): Promise<boolean> {
  const [first, second] = await Promise.all([
    isUserBlocked(supabase, a, b),
    isUserBlocked(supabase, b, a),
  ]);
  return first || second;
}

export async function setUserBlock(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
  block: boolean,
): Promise<{ error: string | null }> {
  if (block) {
    const { error } = await supabase
      .from("user_blocks")
      .upsert(
        { blocker_id: blockerId, blocked_id: blockedId },
        { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
      );
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  return { error: error?.message ?? null };
}

export async function createReport(
  supabase: SupabaseClient,
  input: {
    reporterId: string;
    reportedId: string | null;
    conversationId: string | null;
    reason: string;
    details: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("reports").insert({
    reporter_id: input.reporterId,
    reported_id: input.reportedId,
    conversation_id: input.conversationId,
    reason: input.reason,
    details: input.details.trim() || null,
  });
  return { error: error?.message ?? null };
}

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export async function loadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as Notification[];
}

export async function markAllNotificationsRead(supabase: SupabaseClient, userId: string) {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

export function isOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün`;
  return new Date(value).toLocaleDateString("tr-TR");
}
