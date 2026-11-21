"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { MessageIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  loadConversations,
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
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  async function clearChat(conversationId: string) {
    if (!supabase || !user) return;
    setConfirmId(null);
    await saveConversationState(supabase, conversationId, user.id, {
      cleared_at: new Date().toISOString(),
    });
    setConversations((prev) => prev.filter((row) => row.id !== conversationId));
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Mesajlar</h1>
          <p className="mt-1 text-xs text-muted-2 sm:text-sm">Satıcı ve alıcı sohbetlerin</p>
        </div>
        <Link href="/ilanlar" className="btn btn-ghost h-9 px-3 text-xs">
          <PlusIcon width={15} height={15} /> Yeni sohbet
        </Link>
      </div>

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
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent-soft to-accent-deep text-sm font-extrabold text-ink">
                    {other?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (other?.username ?? "?").charAt(0).toUpperCase()
                    )}
                  </span>
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
                      <span className="ml-auto shrink-0 text-[0.62rem] text-muted-2">
                        {preview ? timeAgo(preview.created_at) : ""}
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
