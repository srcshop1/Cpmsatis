"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { FramedAvatar } from "@/components/user-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { CheckIcon, MessageIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  loadConversations,
  loadUnreadMessages,
  markAllConversationsRead,
  saveConversationState,
  timeAgo,
  type Conversation,
} from "@/lib/social";

const PREVIEW_LENGTH = 60;

export default function MessagesPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [allReadNotice, setAllReadNotice] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;

    const load = async () => {
      const rows = await loadConversations(supabase, user.id);
      if (cancelled) return;

      const ids = rows.map((row) => row.id);
      const previews = new Map<string, { body: string; created_at: string }>();
      if (ids.length > 0) {
        const { data } = await supabase
          .from("messages")
          .select("conversation_id, body, created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(200);
        for (const message of (data ?? []) as {
          conversation_id: string;
          body: string;
          created_at: string;
        }[]) {
          if (!previews.has(message.conversation_id)) previews.set(message.conversation_id, message);
        }
      }

      if (cancelled) return;
      setConversations(
        rows
          .filter((row) => {
            if (!row.cleared_at) return true;
            const preview = previews.get(row.id);
            if (!preview) return false;
            return new Date(preview.created_at) > new Date(row.cleared_at);
          })
          .map((row) => ({
            ...row,
            last_message: (previews.get(row.id) as never) ?? null,
          })),
      );
      const unreadResult = await loadUnreadMessages(supabase, user.id);
      if (cancelled) return;
      setUnread(unreadResult.byConversation);

      setLoading(false);
    };

    void load();

    // Yeni mesaj gelince liste anında tazelensin
    const channel = supabase
      .channel("mesaj-listesi")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  async function markAllRead() {
    if (!supabase || !user || markingAll) return;
    setMarkingAll(true);
    await markAllConversationsRead(
      supabase,
      user.id,
      conversations.map((row) => row.id),
    );
    setMarkingAll(false);
    setUnread({});
    setAllReadNotice(true);
    setTimeout(() => setAllReadNotice(false), 2500);
  }

  async function clearChat(conversationId: string) {
    if (!supabase || !user) return;
    setConfirmId(null);
    await saveConversationState(supabase, conversationId, user.id, {
      cleared_at: new Date().toISOString(),
    });
    setConversations((prev) => prev.filter((row) => row.id !== conversationId));
    setUnread((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Mesajlar</h1>
          <p className="mt-1 truncate text-xs text-muted-2 sm:text-sm">Satıcı ve alıcı sohbetlerin</p>
        </div>
        <Link href="/ilanlar" className="btn btn-ghost h-9 shrink-0 whitespace-nowrap px-3 text-xs">
          <PlusIcon width={15} height={15} /> Yeni sohbet
        </Link>
      </div>

      {!loading && conversations.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll}
            className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-white/4 px-2.5 text-[0.64rem] font-semibold text-muted-2 transition hover:text-text disabled:opacity-60"
          >
            <CheckIcon width={11} height={11} />
            {markingAll ? "İşaretleniyor…" : "Tümünü okundu"}
          </button>
        </div>
      )}

      {allReadNotice && (
        <p className="mt-3 rounded-lg border border-line bg-white/4 px-3 py-2 text-[0.7rem] text-muted">
          Tüm mesajlar okundu olarak işaretlendi.
        </p>
      )}

      {loading && (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card flex items-center gap-3 p-3.5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-white/6" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-white/6" />
                <div className="h-2.5 w-2/3 animate-pulse rounded bg-white/6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && conversations.length === 0 && (
        <div className="mt-5 card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/4 text-accent">
            <MessageIcon width={28} height={28} />
          </span>
          <div>
            <h2 className="text-base font-bold">Henüz mesajın yok</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-2">
              Bir ilanın altındaki <span className="text-muted">Satıcı ile İletişime Geç</span>{" "}
              butonuna bastığında sohbet burada açılır.
            </p>
          </div>
          <Link href="/ilanlar" className="btn btn-primary h-10 px-5 text-sm">
            İlanlara göz at
          </Link>
        </div>
      )}

      {!loading && conversations.length > 0 && (
        <div className="mt-5 space-y-2">
          {conversations.map((conversation) => {
            const other = conversation.other;
            const preview = conversation.last_message as
              | { body: string; created_at: string }
              | null;
            return (
              <div key={conversation.id} className="card flex items-center gap-3 p-3">
                <Link href={`/mesajlar/sohbet?id=${conversation.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <FramedAvatar
                    src={other?.avatar_url}
                    username={other?.username}
                    frame={other?.equipped_frame}
                    size={44}
                    rounded="rounded-full"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        @{other?.username ?? "kullanıcı"}
                      </span>
                      {conversation.blocked && (
                        <span className="badge border border-danger/30 bg-danger/10 text-[0.55rem] text-danger">
                          engelli
                        </span>
                      )}
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {unread[conversation.id] > 0 && (
                          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.55rem] font-bold leading-none text-ink">
                            {unread[conversation.id] > 9 ? "9+" : unread[conversation.id]}
                          </span>
                        )}
                        <span className="text-[0.62rem] text-muted-2">
                          {preview ? timeAgo(preview.created_at) : ""}
                        </span>
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.75rem] text-muted-2">
                      {preview
                        ? preview.body.slice(0, PREVIEW_LENGTH)
                        : "Sohbeti başlatmak için yaz"}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmId(conversation.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-2 transition hover:bg-danger/10 hover:text-danger"
                  aria-label="Sohbeti sil"
                  title="Sohbeti sil"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Sohbet silinsin mi?"
        description="Sohbet listeden kaldırılır. Karşı taraf silmez, yeni mesaj gelirse tekrar görünür."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        danger
        onConfirm={() => confirmId && clearChat(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </AppShell>
  );
}
