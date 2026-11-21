"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { BellIcon, CheckIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveSales } from "@/lib/sales";
import {
  loadNotifications,
  markAllNotificationsRead,
  timeAgo,
  type Notification,
} from "@/lib/social";

export default function NotificationsPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;

    const load = async () => {
      await resolveSales(supabase);
      const rows = await loadNotifications(supabase, user.id);
      if (!cancelled) {
        setItems(rows);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  async function markRead(id: string) {
    if (!supabase) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)),
    );
  }

  async function markAll() {
    if (!supabase || !user) return;
    await markAllNotificationsRead(supabase, user.id);
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Bildirimler</h1>
          <p className="mt-1 text-xs text-muted-2 sm:text-sm">
            {unread > 0 ? `${unread} okunmamış bildirim` : "Tümü okundu"}
          </p>
        </div>
        {unread > 0 && (
          <button type="button" onClick={markAll} className="btn btn-ghost h-9 px-3 text-xs">
            <CheckIcon width={14} height={14} /> Tümünü okundu yap
          </button>
        )}
      </div>

      {loading && <p className="mt-6 text-sm text-muted-2">Yükleniyor…</p>}

      {!loading && items.length === 0 && (
        <div className="mt-5 card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/4 text-accent">
            <BellIcon width={28} height={28} />
          </span>
          <div>
            <h2 className="text-base font-bold">Bildirim yok</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-2">
              Satış onayı, değerlendirme isteği ve başvuru sonuçları burada görünecek.
            </p>
          </div>
          <Link href="/ilanlar" className="btn btn-primary h-10 px-5 text-sm">
            İlanlara göz at
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="mt-5 space-y-2">
          {items.map((item) => {
            const content = (
              <>
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    item.read_at ? "bg-transparent" : "bg-accent"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{item.title}</span>
                    <span className="shrink-0 text-[0.62rem] text-muted-2">
                      {timeAgo(item.created_at)}
                    </span>
                  </span>
                  {item.body && (
                    <span className="mt-0.5 block line-clamp-2 text-[0.75rem] leading-relaxed text-muted-2">
                      {item.body}
                    </span>
                  )}
                </span>
              </>
            );

            return item.link ? (
              <Link
                key={item.id}
                href={item.link}
                onClick={() => markRead(item.id)}
                className={`card flex items-start gap-2.5 p-3.5 transition hover:border-accent/40 ${
                  item.read_at ? "opacity-70" : ""
                }`}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.id}
                type="button"
                onClick={() => markRead(item.id)}
                className={`card flex w-full items-start gap-2.5 p-3.5 text-left transition hover:border-accent/40 ${
                  item.read_at ? "opacity-70" : ""
                }`}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
