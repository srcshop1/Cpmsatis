"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth/auth-provider";
import {
  BoxIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  ImagePlusIcon,
  MoreIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { formatPrice } from "@/lib/catalog";
import { FramedAvatar, StaffBadge, VerifiedTick } from "@/components/user-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { prepareAvatar, storageErrorMessage } from "@/lib/image";
import {
  REPORT_REASONS,
  createReport,
  isConversationBlocked,
  isBlockedEitherWay,
  loadMessages,
  loadProfileMini,
  markMessagesRead,
  saveConversationState,
  sendMessage,
  timeAgo,
  type Message,
  type ProfileMini,
} from "@/lib/social";

type ConversationRow = {
  id: string;
  listing_id: string | null;
  user_a: string;
  user_b: string;
};

type ListingRef = { title: string; price: number; image?: string } | null;

type PickListing = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  seller_id: string;
};

/** WhatsApp benzeri küçük çift tik: okunduysa turuncu, okunmadıysa gri */
function ReadTicks({ read }: { read: boolean }) {
  return (
    <svg
      width="13"
      height="9"
      viewBox="0 0 16 11"
      fill="none"
      aria-label={read ? "Okundu" : "İletildi"}
      className={read ? "text-[#0b1a3a]" : "text-[#cfd8e6]"}
    >
      <path
        d="M1 6.1L4.1 9.2L11.2 1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.6 6.1L8.7 9.2L15.6 1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatClient() {
  const searchParams = useSearchParams();
  const conversationId = searchParams?.get("id") ?? "";
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [other, setOther] = useState<ProfileMini | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [listing, setListing] = useState<{ id: string; title: string; price: number; images: string[] | null } | null>(null);
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerRows, setPickerRows] = useState<PickListing[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ id: string; x: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase || !user || !conversationId) return;
    let cancelled = false;

    const bootstrap = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, listing_id, user_a, user_b")
        .eq("id", conversationId)
        .maybeSingle();

      if (cancelled) return;
      if (!data) {
        setError("Sohbet bulunamadı ya da erişimin yok.");
        setLoading(false);
        return;
      }
      const row = data as ConversationRow;
      setConversation(row);

      const otherId = row.user_a === user.id ? row.user_b : row.user_a;
      const profiles = await loadProfileMini(supabase, [otherId]);
      if (!cancelled) setOther(profiles.get(otherId) ?? null);

      if (row.listing_id) {
        const { data: listingRow } = await supabase
          .from("listings")
          .select("id, title, price, images")
          .eq("id", row.listing_id)
          .maybeSingle();
        if (!cancelled) setListing(listingRow as typeof listing);
      }

      const { data: state } = await supabase
        .from("conversation_state")
        .select("cleared_at, blocked")
        .eq("conversation_id", row.id)
        .eq("user_id", user.id)
        .maybeSingle();

      const cleared = (state as { cleared_at: string | null } | null)?.cleared_at ?? null;
      if (!cancelled) {
        setClearedAt(cleared);
        const blockedBetween = await isBlockedEitherWay(supabase, user.id, otherId);
        setBlocked(
          blockedBetween ||
            Boolean((state as { blocked: boolean } | null)?.blocked) ||
            (await isConversationBlocked(supabase, row.id)),
        );
      }

      await markMessagesRead(supabase, row.id, user.id);
      const rows = await loadMessages(supabase, row.id, cleared);
      if (!cancelled) {
        setMessages(rows);
        setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [supabase, user, conversationId]);

  // Yeni mesajları periyodik çek
  useEffect(() => {
    if (!supabase || !conversation) return;
    const refresh = async (markRead: boolean) => {
      if (!user) return;
      if (markRead && typeof document !== "undefined" && document.visibilityState === "visible") {
        await markMessagesRead(supabase, conversation.id, user.id);
      }
      const rows = await loadMessages(supabase, conversation.id, clearedAt);
      setMessages(rows);
      setBlocked(await isConversationBlocked(supabase, conversation.id));
    };

    const timer = setInterval(() => void refresh(true), 3000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [supabase, conversation, clearedAt]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    if (!supabase || !user || !conversation || !draft.trim()) return;
    if (blocked) {
      setError("Bu sohbette engelleme var, mesaj gönderilemez.");
      return;
    }
    const body = draft;
    setDraft("");
    const result = await sendMessage(supabase, {
      conversationId: conversation.id,
      senderId: user.id,
      body,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            username:
              replyTo.sender_id === user.id
                ? user.username ?? "sen"
                : other?.username ?? "kullanıcı",
            body:
              replyTo.listing_ref?.kind === "image"
                ? "Görsel"
                : replyTo.listing_ref?.title ?? replyTo.body,
            kind: replyTo.listing_ref?.kind === "image" ? "image" : replyTo.listing_ref?.kind ?? "text",
          }
        : null,
    });
    if (result.error) {
      setDraft(body);
      setError(result.error);
      return;
    }
    setError(null);
    setReplyTo(null);
    setMessages(await loadMessages(supabase, conversation.id, clearedAt));
  }

  function jumpToMessage(id?: string) {
    if (!id) return;
    const element = document.getElementById(`msg-${id}`);
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId(null), 1400);
  }

  async function sendImage(file: File) {
    if (!supabase || !user || !conversation) return;
    if (blocked) {
      setError("Bu sohbette engelleme var, mesaj gönderilemez.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const blob = await prepareAvatar(file, 1280, 0.82);
      const path = `${user.id}/chat/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) {
        setError(storageErrorMessage(uploadError.message));
        return;
      }
      const { data: publicUrl } = supabase.storage.from("listing-images").getPublicUrl(path);
      const result = await sendMessage(supabase, {
        conversationId: conversation.id,
        senderId: user.id,
        body: "Görsel",
        listingRef: { kind: "image", image: publicUrl.publicUrl, title: "Görsel" },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessages(await loadMessages(supabase, conversation.id, clearedAt));
    } catch {
      setError("Görsel gönderilemedi. Lütfen tekrar dene.");
    } finally {
      setUploading(false);
    }
  }

  async function openPicker() {
    if (!supabase || !user) return;
    setPlusOpen(false);
    setPickerOpen(true);
    setPickerLoading(true);
    const ids = [user.id, other?.id].filter(Boolean) as string[];
    const { data } = await supabase
      .from("listings")
      .select("id, title, price, images, seller_id")
      .in("seller_id", ids)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(30);
    setPickerRows((data ?? []) as PickListing[]);
    setPickerLoading(false);
  }

  async function sendListing(item: PickListing) {
    if (!supabase || !user || !conversation) return;
    const result = await sendMessage(supabase, {
      conversationId: conversation.id,
      senderId: user.id,
      body: `${item.title} — ${formatPrice(item.price)}`,
      listingRef: {
        id: item.id,
        title: item.title,
        price: item.price,
        image: item.images?.[0],
        kind: "listing",
      },
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setPickerOpen(false);
    setError(null);
    setMessages(await loadMessages(supabase, conversation.id, clearedAt));
  }

  async function toggleBlock() {
    if (!supabase || !user || !conversation) return;
    const next = !blocked;
    await saveConversationState(supabase, conversation.id, user.id, { blocked: next });
    setBlocked(next);
    setMenuOpen(false);
  }

  async function clearChat() {
    if (!supabase || !user || !conversation) return;
    setConfirmClear(false);
    const now = new Date().toISOString();
    await saveConversationState(supabase, conversation.id, user.id, { cleared_at: now });
    setClearedAt(now);
    setMessages([]);
    setMenuOpen(false);
  }

  async function submitReport() {
    if (!supabase || !user || !conversation) return;
    const result = await createReport(supabase, {
      reporterId: user.id,
      reportedId: other?.id ?? null,
      conversationId: conversation.id,
      reason: reportReason,
      details: reportDetails,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setReportDone(true);
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col">
        <div className="flex items-center gap-2">
          <Link
            href="/mesajlar"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/3 text-muted transition hover:text-text"
            aria-label="Geri"
          >
            <ChevronLeftIcon width={17} height={17} />
          </Link>

          <Link
            href={other?.id ? `/kullanici?id=${other.id}` : "/mesajlar"}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl transition hover:opacity-85"
            aria-label="Profili aç"
          >
            <FramedAvatar
              src={other?.avatar_url}
              username={other?.username}
              frame={other?.equipped_frame}
              size={36}
              rounded="rounded-full"
            />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                <span className="truncate">@{other?.username ?? "kullanıcı"}</span>
                {other?.verified_seller && <VerifiedTick size={13} />}
                {other?.staff_tag && <StaffBadge tag={other.staff_tag} small />}
              </p>
              <p className="text-[0.65rem] text-muted-2">
                {other?.sales_count ?? 0} başarılı işlem ·{" "}
                {(other?.review_count ?? 0) > 0 && other?.rating
                  ? `${Number(other.rating).toFixed(1)} ★`
                  : "puan yok"}
              </p>
            </div>
            <ChevronRightIcon width={15} height={15} className="shrink-0 text-muted-2" />
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/3 text-muted transition hover:text-text"
              aria-label="Sohbet menüsü"
            >
              <MoreIcon width={18} height={18} />
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Kapat"
                />
                <div className="animate-pop absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
                  <button
                    type="button"
                    onClick={toggleBlock}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[0.78rem] text-text hover:bg-white/5"
                  >
                    <ShieldIcon width={15} height={15} /> {blocked ? "Engeli kaldır" : "Kişiyi engelle"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[0.78rem] text-text hover:bg-white/5"
                  >
                    <TrashIcon width={15} height={15} /> Sohbeti temizle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setReportOpen(true);
                      setReportDone(false);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[0.78rem] text-[#ffb3bb] hover:bg-danger/10"
                  >
                    <FlagIcon width={15} height={15} /> Bildir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {listing && (
          <Link
            href={`/ilan/goruntule?id=${listing.id}`}
            className="mt-3 flex items-center gap-2.5 rounded-xl border border-line bg-white/3 p-2"
          >
            {listing.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.images[0]} alt="" className="h-11 w-11 rounded-lg object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-black/30">🖼️</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8rem] font-semibold">{listing.title}</span>
              <span className="block text-[0.7rem] text-accent">{formatPrice(listing.price)}</span>
            </span>
            <ChevronLeftIcon width={15} height={15} className="rotate-180 text-muted-2" />
          </Link>
        )}

        {blocked && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-[#ffb3bb]">
            Bu sohbette engelleme var. Yeni mesaj gönderilemez.
          </div>
        )}

        <div
          ref={listRef}
          className="mt-3 h-[52vh] min-h-[260px] space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-line-soft bg-black/20 p-3 sm:h-[56vh]"
        >
          {loading && <p className="py-8 text-center text-xs text-muted-2">Yükleniyor…</p>}

          {!loading && messages.length === 0 && (
            <p className="py-10 text-center text-xs leading-relaxed text-muted-2">
              İlk mesajı sen yaz. İlanla ilgileniyorsan üstteki karttan ilanı açabilirsin.
            </p>
          )}

          {messages.map((message) => {
            const mine = message.sender_id === user?.id;
            const ref = message.listing_ref;
            const quote = message.reply_to;
            const dragging = drag?.id === message.id ? drag.dx : 0;
            const highlighted = highlightId === message.id;
            return (
              <div
                key={message.id}
                id={`msg-${message.id}`}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                onTouchStart={(event) => {
                  touchStart.current = { id: message.id, x: event.touches[0].clientX };
                }}
                onTouchMove={(event) => {
                  const start = touchStart.current;
                  if (!start || start.id !== message.id) return;
                  const dx = event.touches[0].clientX - start.x;
                  // Kendi mesajımızı sağa, karşı tarafın mesajını sola kaydırınca yanıtlanır
                  if (mine) {
                    if (dx > 6) setDrag({ id: message.id, dx: Math.min(dx, 70) });
                  } else if (dx < -6) {
                    setDrag({ id: message.id, dx: Math.max(dx, -70) });
                  }
                }}
                onTouchEnd={() => {
                  if (drag && drag.id === message.id) {
                    const enough = mine ? drag.dx >= 44 : drag.dx <= -44;
                    if (enough) setReplyTo(message);
                  }
                  setDrag(null);
                  touchStart.current = null;
                }}
              >
                <div
                  style={dragging !== 0 ? { transform: `translateX(${dragging}px)` } : undefined}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.82rem] leading-relaxed transition-transform ${
                    mine
                      ? "rounded-br-md bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white"
                      : "rounded-bl-md border border-line bg-surface-2 text-text"
                  } ${highlighted ? "ring-2 ring-accent/70" : ""}`}
                >
                  {(quote?.body || quote?.kind) && (
                    <button
                      type="button"
                      onClick={() => jumpToMessage(quote?.id)}
                      className={`mb-1.5 block w-full overflow-hidden rounded-lg border-l-2 px-2 py-1 text-left text-[0.66rem] ${
                        mine
                          ? "border-white/70 bg-black/20 text-white/85"
                          : "border-accent/70 bg-white/5 text-muted"
                      }`}
                    >
                      <span className="block truncate font-semibold">
                        @{quote?.username ?? "kullanıcı"}
                      </span>
                      <span className="block truncate opacity-80">
                        {quote?.kind === "image" ? "📷 Görsel" : quote?.body}
                      </span>
                    </button>
                  )}

                  {ref?.kind === "image" && ref.image ? (
                    <a href={ref.image} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ref.image}
                        alt="Görsel"
                        className="max-h-64 w-full rounded-lg object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : ref?.title ? (
                    <a
                      href={ref.id ? `/ilan/goruntule?id=${ref.id}` : undefined}
                      className={`mb-0.5 flex items-center gap-2.5 rounded-xl p-2 ${
                        mine ? "bg-black/20" : "bg-white/5"
                      }`}
                    >
                      {ref.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ref.image}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-black/25 text-lg">
                          🖼️
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[0.78rem] font-bold leading-snug">
                          {ref.title}
                        </span>
                        {typeof ref.price === "number" && (
                          <span className="mt-1 block text-[0.72rem] font-bold">
                            {formatPrice(ref.price)}
                          </span>
                        )}
                      </span>
                    </a>
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{message.body}</span>
                  )}

                  <span
                    className={`float-right ml-1.5 mt-1 inline-flex items-center gap-1 rounded-full px-1 text-[0.52rem] leading-none ${
                      mine ? "bg-black/25 text-white/70" : "text-muted-2"
                    }`}
                  >
                    {timeAgo(message.created_at)}
                    {mine && <ReadTicks read={Boolean(message.read_at)} />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        {replyTo ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white/4 px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-[0.8rem] text-accent">
              ↩
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.66rem] font-semibold text-accent">
                @
                {replyTo.sender_id === user?.id
                  ? user?.username ?? "sen"
                  : other?.username ?? "kullanıcı"}
              </span>
              <span className="block truncate text-[0.7rem] text-muted">
                {replyTo.listing_ref?.kind === "image"
                  ? "📷 Görsel"
                  : replyTo.listing_ref?.title ?? replyTo.body}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-2 transition hover:text-text"
              aria-label="Yanıtı kaldır"
            >
              <XIcon width={14} height={14} />
            </button>
          </div>
        ) : null}

        {plusOpen && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPlusOpen(false);
                fileRef.current?.click();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white/4 py-2.5 text-[0.75rem] font-semibold text-text transition hover:border-accent/50"
            >
              <ImagePlusIcon width={16} height={16} /> Görsel Gönder
            </button>
            <button
              type="button"
              onClick={openPicker}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white/4 py-2.5 text-[0.75rem] font-semibold text-text transition hover:border-accent/50"
            >
              <BoxIcon width={16} height={16} /> İlan Gönder
            </button>
          </div>
        )}

        <div className="mt-2 flex items-end gap-2 pb-2">
          <button
            type="button"
            onClick={() => setPlusOpen((prev) => !prev)}
            disabled={blocked || uploading}
            aria-label="Görsel veya ilan gönder"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition disabled:opacity-40 ${
              plusOpen
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-line bg-white/4 text-muted hover:text-text"
            }`}
          >
            {uploading ? <Spinner /> : <PlusIcon width={18} height={18} />}
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={blocked ? "Engel nedeniyle yazılamıyor" : "Mesaj yaz…"}
            disabled={blocked}
            className="field max-h-32 min-h-11 flex-1 resize-y py-2.5 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={blocked || !draft.trim()}
            className="btn btn-primary h-11 shrink-0 px-4 text-sm disabled:opacity-50"
          >
            Gönder
          </button>
        </div>

      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void sendImage(file);
        }}
      />

      {pickerOpen && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setPickerOpen(false)}
            aria-label="Kapat"
          />
          <div className="animate-pop relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line bg-surface sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <h2 className="text-sm font-bold">İlan gönder</h2>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-2 hover:bg-white/5 hover:text-text"
                aria-label="Kapat"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {pickerLoading && <p className="py-8 text-center text-xs text-muted-2">Yükleniyor…</p>}

              {!pickerLoading && pickerRows.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-2">Yayında ilan bulunamadı.</p>
              )}

              {!pickerLoading &&
                (["mine", "theirs"] as const).map((group) => {
                  const rows = pickerRows.filter((row) =>
                    group === "mine" ? row.seller_id === user?.id : row.seller_id !== user?.id,
                  );
                  if (rows.length === 0) return null;
                  return (
                    <div key={group} className="mb-3">
                      <p className="mb-1.5 px-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-2">
                        {group === "mine" ? "Senin ilanların" : "Karşı tarafın ilanları"}
                      </p>
                      <div className="space-y-1.5">
                        {rows.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => void sendListing(row)}
                            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-white/4 p-2 text-left transition hover:border-accent/50"
                          >
                            {row.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.images[0]}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/30">
                                🖼️
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.78rem] font-semibold">
                                {row.title}
                              </span>
                              <span className="block text-[0.7rem] text-accent">
                                {formatPrice(row.price)}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setReportOpen(false)}
            aria-label="Kapat"
          />
          <div className="animate-pop relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Kullanıcıyı bildir</h2>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-2 hover:bg-white/5 hover:text-text"
                aria-label="Kapat"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>

            {reportDone ? (
              <div className="py-8 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-mint/30 bg-mint/10 text-mint">
                  <CheckIcon width={22} height={22} />
                </span>
                <p className="mt-3 text-sm font-semibold">Bildirin alındı</p>
                <p className="mt-1 text-xs text-muted-2">
                  Yetkili ekibimiz sohbeti inceleyecek.
                </p>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="btn btn-ghost mt-4 h-9 px-4 text-xs"
                >
                  Kapat
                </button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted-2">Neden bildiriyorsun?</p>
                <div className="mt-2 space-y-1.5">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[0.78rem] ${
                        reportReason === reason
                          ? "border-accent/50 bg-accent/10 text-text"
                          : "border-line-soft bg-white/3 text-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        className="h-3.5 w-3.5 accent-[#ff8a1f]"
                        checked={reportReason === reason}
                        onChange={() => setReportReason(reason)}
                      />
                      {reason}
                    </label>
                  ))}
                </div>

                <label className="mt-3 block text-xs text-muted">
                  Bildirim sebebi / açıklama
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="field mt-1 resize-y"
                  placeholder="Kısaca ne olduğunu yaz…"
                />

                <button
                  type="button"
                  onClick={submitReport}
                  className="btn btn-primary mt-3 h-11 w-full"
                >
                  Bildirimi Gönder
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmClear}
        title="Sohbet temizlensin mi?"
        description="Bu sohbetteki mesajlar senin için gizlenir."
        confirmLabel="Temizle"
        danger
        onConfirm={clearChat}
        onCancel={() => setConfirmClear(false)}
      />
    </AppShell>
  );
}
