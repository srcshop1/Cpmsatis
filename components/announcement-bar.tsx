"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DISMISS_KEY = "cpms_announcement_dismissed";

/** Sitenin üstünde görünen ince altın duyuru şeridi */
export function AnnouncementBar() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [item, setItem] = useState<{ id: string; body: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || error || !data) return;

      let dismissed: string | null = null;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY);
      } catch {
        /* yoksay */
      }
      if (dismissed === data.id) return;

      setItem({ id: data.id as string, body: (data.body as string) ?? "" });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!item) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, item!.id);
    } catch {
      /* yoksay */
    }
    setItem(null);
  }

  return (
    <div className="border-b border-[#ffd166]/25 bg-gradient-to-r from-[#ffd166]/12 via-[#ffb347]/10 to-[#ffd166]/12">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1.5">
        <span className="shrink-0 text-[0.7rem]" aria-hidden>
          📣
        </span>
        <p className="min-w-0 flex-1 truncate text-[0.72rem] font-medium text-[#ffe1a0]">
          {item.body}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[0.65rem] text-[#ffe1a0]/70 transition hover:bg-black/20 hover:text-[#ffe1a0]"
          aria-label="Duyuruyu kapat"
          title="Kapat"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
