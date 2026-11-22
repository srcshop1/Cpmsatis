"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { StaffBadge, VerifiedTick } from "@/components/user-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type MemberHit = {
  id: string;
  username: string;
  email: string | null;
  sales_count: number | null;
  verified_seller: boolean | null;
  staff_tag: string | null;
};

/** Kullanıcı adı veya e-posta ile üye arar, seçileni döndürür. */
export function MemberSearch({
  onPick,
  selectedId,
  placeholder = "Kullanıcı adı veya e-posta",
}: {
  onPick: (member: MemberHit) => void;
  selectedId?: string | null;
  placeholder?: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const value = query.trim();
    if (!supabase || value.length < 2) {
      setHits([]);
      setEmpty(false);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, sales_count, verified_seller, staff_tag")
        .or(`username.ilike.%${value}%,email.ilike.%${value}%`)
        .order("username", { ascending: true })
        .limit(8);

      if (cancelled) return;

      if (error) {
        const retry = await supabase
          .from("profiles")
          .select("id, username, email, sales_count")
          .or(`username.ilike.%${value}%,email.ilike.%${value}%`)
          .order("username", { ascending: true })
          .limit(8);
        if (cancelled) return;
        const rows = (retry.data ?? []) as unknown as MemberHit[];
        setHits(rows);
        setEmpty(rows.length === 0);
      } else {
        const rows = (data ?? []) as unknown as MemberHit[];
        setHits(rows);
        setEmpty(rows.length === 0);
      }
      setSearching(false);
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, supabase]);

  return (
    <div>
      <input
        className="field"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {searching && (
        <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-muted-2">
          <Spinner /> Aranıyor…
        </p>
      )}

      {!searching && empty && (
        <p className="mt-2 text-[0.7rem] text-muted-2">Kullanıcı bulunamadı.</p>
      )}

      {hits.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => {
                onPick(hit);
                setHits([]);
                setQuery("");
                setEmpty(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[0.75rem] transition ${
                selectedId === hit.id
                  ? "border-accent/60 bg-accent/10"
                  : "border-line-soft bg-white/3 hover:border-line hover:bg-white/6"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-semibold">@{hit.username}</span>
                {hit.verified_seller && <VerifiedTick size={11} />}
                {hit.staff_tag && <StaffBadge tag={hit.staff_tag} small />}
              </span>
              <span className="ml-auto shrink-0 text-[0.65rem] text-muted-2">
                {hit.sales_count ?? 0} işlem
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
