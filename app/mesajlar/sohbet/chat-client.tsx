"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CheckIcon,
  ChevronLeftIcon,
  FlagIcon,
  MoreIcon,
  ShieldIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { formatPrice } from "@/lib/catalog";
import { FramedAvatar, StaffBadge, VerifiedTick } from "@/components/user-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  REPORT_REASONS,
  createReport,
  isConversationBlocked,
  loadMessages,
  loadProfileMini,
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
  const bottomRef = useRef<HTMLDivElement>(null);

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
        setBlocked(
          Boolean((state as { blocked: boolean } | null)?.blocked) ||
            (await isConversationBlocked(supabase, row.id)),
        );
      }

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
    const timer = setInterval(async () => {
      const rows = await loadMessages(supabase, conversation.id, clearedAt);
      setMessages(rows);
      setBlocked(await isConversationBlocked(supabase, conversation.id));
    }, 4000);
    return () => clearInterval(timer);
  }, [supabase, conversation, clearedAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    });
    if (result.error) {
      setDraft(body);
      setError(result.error);
      return;
    }
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
    if (!window.confirm("Sohbeti temizlemek istediğine emin misin?")) return;
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

  const listingRef: ListingRef = listing
    ? { title: listing.title, price: listing.price, image: listing.images?.[0] }
    : null;

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

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
                {other?.sales_count ?? 0} başarılı işlem · {other?.rating ? `${Number(other.rating).toFixed(1)} ★` : "puan yok"}
              </p>
            </div>
          </div>

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
                    onClick={clearChat}
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

        <div className="mt-3 min-h-[45vh] space-y-2 rounded-2xl border border-line-soft bg-black/20 p-3">
          {loading && <p className="py-8 text-center text-xs text-muted-2">Yükleniyor…</p>}

          {!loading && messages.length === 0 && (
            <p className="py-10 text-center text-xs leading-relaxed text-muted-2">
              İlk mesajı sen yaz. İlanla ilgileniyorsan üstteki karttan ilanı açabilirsin.
            </p>
          )}

          {messages.map((message) => {
            const mine = message.sender_id === user?.id;
            const ref = message.listing_ref;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.82rem] leading-relaxed ${
                    mine
                      ? "rounded-br-md bg-accent/90 text-ink"
                      : "rounded-bl-md border border-line bg-surface-2 text-text"
                  }`}
                >
                  {ref?.title && (
                    <span
                      className={`mb-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.66rem] ${
                        mine ? "bg-black/15" : "bg-white/5"
                      }`}
                    >
                      <span className="truncate">{ref.title}</span>
                      {typeof ref.price === "number" && (
                        <span className="ml-auto shrink-0 font-semibold">
                          {formatPrice(ref.price)}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="whitespace-pre-wrap break-words">{message.body}</span>
                  <span
                    className={`mt-1 block text-right text-[0.58rem] ${
                      mine ? "text-black/50" : "text-muted-2"
                    }`}
                  >
                    {timeAgo(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        <div className="mt-2 flex items-end gap-2 pb-2">
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

        {listingRef && (
          <button
            type="button"
            onClick={() => {
              setDraft(
                `Şu ilanla ilgileniyorum;\n${listingRef.title} — ${formatPrice(listingRef.price)}`,
              );
            }}
            className="mb-3 self-start rounded-lg border border-line bg-white/3 px-2.5 py-1.5 text-[0.68rem] text-muted transition hover:text-text"
          >
            İlan bilgisini mesaja ekle
          </button>
        )}
      </div>

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
    </AppShell>
  );
}
