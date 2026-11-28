"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BellIcon, CheckIcon, TrashIcon, XIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveSales } from "@/lib/sales";
import {
  loadNotifications,
  markAllNotificationsRead,
  notifyNotificationChanged,
  timeAgo,
  type Notification,
} from "@/lib/social";

export default function NotificationsPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<Notification | null>(null);

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
    notifyNotificationChanged();
  }

  async function markAll() {
    if (!supabase || !user) return;
    await markAllNotificationsRead(supabase, user.id);
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
  }

  function startSelect() {
    setError(null);
    setSelectMode(true);
    setSelected([]);
  }

  function stopSelect() {
    setSelectMode(false);
    setSelected([]);
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  const allSelected = items.length > 0 && selected.length === items.length;

  function toggleAll() {
    setSelected(allSelected ? [] : items.map((item) => item.id));
  }

  async function deleteSelected() {
    if (!supabase || selected.length === 0) return;
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .in("id", selected);
    setDeleting(false);
    setConfirmDelete(false);

    if (deleteError) {
      setError("Seçilenler silinemedi. Lütfen tekrar dene.");
      return;
    }

    const removed = new Set(selected);
    setItems((prev) => prev.filter((item) => !removed.has(item.id)));
    stopSelect();
    notifyNotificationChanged();
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Bildirimler</h1>
          <p className="mt-1 text-xs text-muted-2 sm:text-sm">
            {selectMode
              ? selected.length > 0
                ? `${selected.length} bildirim seçildi`
                : "Silmek için bildirimlere dokun"
              : unread > 0
                ? `${unread} okunmamış bildirim`
                : "Tümü okundu"}
          </p>
        </div>

        {!selectMode ? (
          <div className="flex shrink-0 items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                aria-label="Tümünü okundu yap"
                className="btn btn-ghost h-9 px-2.5 text-xs"
              >
                <CheckIcon width={14} height={14} />
                <span className="hidden sm:inline">Tümünü okundu yap</span>
              </button>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={startSelect}
                aria-label="Bildirim seç ve sil"
                className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/4 text-muted transition hover:border-danger/50 hover:text-danger"
              >
                <TrashIcon width={16} height={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleAll}
              className="btn btn-ghost h-9 px-2.5 text-[0.7rem]"
            >
              {allSelected ? "Seçimi kaldır" : "Tümünü seç"}
            </button>
            <button
              type="button"
              onClick={stopSelect}
              aria-label="Seçimi bırak"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/4 text-muted transition hover:text-text"
            >
              <XIcon width={15} height={15} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={selected.length === 0}
              aria-label="Seçilenleri sil"
              className="grid h-9 w-9 place-items-center rounded-xl bg-danger text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <TrashIcon width={16} height={16} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-danger/35 bg-danger/10 px-3.5 py-2.5 text-xs text-[#ffb3bb]">
          {error}
        </div>
      )}

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
            const checked = selected.includes(item.id);
            const content = (
              <>
                {selectMode ? (
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                      checked
                        ? "border-danger bg-danger text-white"
                        : "border-line bg-white/4 text-transparent"
                    }`}
                  >
                    <CheckIcon width={12} height={12} />
                  </span>
                ) : (
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      item.read_at ? "bg-transparent" : "bg-accent"
                    }`}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{item.title}</span>
                    <span className="shrink-0 text-[0.62rem] text-muted-2">
                      {timeAgo(item.created_at)}
                    </span>
                  </span>
                  {item.body && (
                    <span className="mt-0.5 block whitespace-pre-line break-words text-[0.75rem] leading-relaxed text-muted-2">
                      {item.body}
                    </span>
                  )}
                </span>
              </>
            );

            const rowClass = `card flex items-start gap-2.5 p-3.5 text-left transition ${
              selectMode && checked
                ? "border-danger/60 bg-danger/10"
                : selectMode
                  ? "hover:border-danger/40"
                  : "hover:border-accent/40"
            } ${item.read_at && !checked ? "opacity-70" : ""}`;

            if (selectMode) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={checked}
                  className={`${rowClass} w-full`}
                >
                  {content}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void markRead(item.id);
                  setOpenItem(item);
                }}
                className={`${rowClass} w-full`}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}

      {openItem && (
        <div className="fixed inset-0 z-[130] flex flex-col bg-[#07090d]">
          <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
            <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-2">
              Bildirim · {timeAgo(openItem.created_at)}
            </span>
            <button
              type="button"
              onClick={() => setOpenItem(null)}
              className="flex items-center gap-1 rounded-lg border border-line bg-white/8 px-2.5 py-1.5 text-[0.7rem] font-semibold text-text"
              aria-label="Kapat"
            >
              <XIcon width={14} height={14} /> Kapat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <h2 className="text-xl font-extrabold leading-snug text-text sm:text-2xl">
              {openItem.title}
            </h2>
            {openItem.body && (
              <p className="mt-4 whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-muted">
                {openItem.body}
              </p>
            )}
            {openItem.link && (
              <Link
                href={openItem.link}
                onClick={() => setOpenItem(null)}
                className="btn btn-primary mt-6 h-11 w-full text-sm"
              >
                İlgili sayfaya git
              </Link>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Seçilen bildirimler silinsin mi?"
        description={`${selected.length} bildirim kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        danger
        busy={deleting}
        onConfirm={() => void deleteSelected()}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppShell>
  );
}
