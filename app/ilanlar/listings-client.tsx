"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { ListingCard } from "@/components/listing-card";
import {
  BoltIcon,
  CheckIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  XIcon,
} from "@/components/icons";
import { MAX_LISTING_PRICE, listingCategories } from "@/lib/catalog";
import {
  expireListings,
  fetchListings,
  purgeExpiredListings,
  touchLastSeen,
  type Listing,
} from "@/lib/listings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Filters = {
  categories: string[];
  min: string;
  max: string;
  online: boolean;
  deals: boolean;
  verified: boolean;
};

function readFilters(params: URLSearchParams): Filters {
  const categories = (params.get("kategori") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => listingCategories.some((category) => category.slug === value));

  return {
    categories,
    min: params.get("min") ?? "",
    max: params.get("max") ?? "",
    online: params.get("online") === "1",
    deals: params.get("deals") === "1",
    verified: params.get("onayli") === "1",
  };
}

export function ListingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const query = (searchParams.get("q") ?? "").trim();
  const filtersKey = searchParams.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(filtersKey)), [filtersKey]);
  const activeFilterCount =
    filters.categories.length +
    (filters.min ? 1 : 0) +
    (filters.max ? 1 : 0) +
    (filters.online ? 1 : 0) +
    (filters.deals ? 1 : 0) +
    (filters.verified ? 1 : 0);

  const [search, setSearch] = useState(query);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(filters);

  useEffect(() => {
    if (!supabase) {
      setLoadState("error");
      setLoadError("Supabase anahtarları bulunamadı. .env.local dosyasını kontrol et.");
      return;
    }

    let cancelled = false;
    setLoadState("loading");

    const parsed = readFilters(new URLSearchParams(filtersKey));

    const load = async () => {
      // 15 günü dolan ilanları gizle
      await expireListings(supabase);
      await purgeExpiredListings(supabase);

      const { listings: rows, error } = await fetchListings(supabase, {
        query: (new URLSearchParams(filtersKey).get("q") ?? "").trim(),
        categories: parsed.categories,
        min: parsed.min ? Number(parsed.min) : null,
        max: parsed.max ? Number(parsed.max) : null,
        onlineOnly: parsed.online,
        deals10: parsed.deals,
        verifiedOnly: parsed.verified,
      });

      if (cancelled) return;
      if (error) {
        setLoadState("error");
        setLoadError(error);
        return;
      }
      setListings(rows);
      setLoadState("ready");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, filtersKey]);

  useEffect(() => {
    if (supabase && user) void touchLastSeen(supabase, user.id);
  }, [supabase, user]);

  function openPanel() {
    setDraft(filters);
    setOpen(true);
  }

  function buildQuery(nextFilters: Filters, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextFilters.categories.length > 0) params.set("kategori", nextFilters.categories.join(","));
    if (nextFilters.min) params.set("min", nextFilters.min);
    if (nextFilters.max) params.set("max", nextFilters.max);
    if (nextFilters.online) params.set("online", "1");
    if (nextFilters.deals) params.set("deals", "1");
    if (nextFilters.verified) params.set("onayli", "1");
    const queryString = params.toString();
    return `/ilanlar${queryString ? `?${queryString}` : ""}`;
  }

  function applyDraft() {
    setOpen(false);
    router.push(buildQuery(draft, query));
  }

  function clearFilters() {
    const empty: Filters = {
      categories: [],
      min: "",
      max: "",
      online: false,
      deals: false,
      verified: false,
    };
    setDraft(empty);
    setOpen(false);
    router.push(buildQuery(empty, query));
  }

  function toggleCategory(slug: string) {
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.includes(slug)
        ? prev.categories.filter((value) => value !== slug)
        : [...prev.categories, slug],
    }));
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">İlanlar</h1>
          <p className="mt-1 text-xs text-muted-2 sm:text-sm">
            Car Parking Multiplayer dünyasından tüm ilanlar
          </p>
        </div>
        <span className="badge border border-line bg-white/4 text-[0.68rem] text-muted">
          {loadState === "ready" ? `${listings.length} ilan` : "…"}
        </span>
      </div>

      {/* Arama + filtre */}
      <div className="mt-4 flex items-center gap-2">
        <form
          action="/ilanlar"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(buildQuery(filters, search));
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface/90 px-3 py-1"
        >
          <span className="text-muted-2">
            <SearchIcon width={18} height={18} />
          </span>
          <input
            name="q"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="İlan, satıcı ara…"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-[#5d667a]"
            aria-label="İlanlarda ara"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                router.push(buildQuery(filters, ""));
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-2 hover:text-text"
              aria-label="Aramayı temizle"
            >
              <XIcon width={14} height={14} />
            </button>
          )}
        </form>

        <button
          type="button"
          onClick={openPanel}
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
            activeFilterCount > 0
              ? "border-accent/60 bg-accent/12 text-accent"
              : "border-line bg-surface/90 text-muted hover:text-text"
          }`}
          aria-label="Filtreler"
        >
          <FilterIcon width={19} height={19} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.62rem] font-bold text-ink">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Aktif filtreler */}
      {activeFilterCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {filters.categories.map((slug) => {
            const category = listingCategories.find((item) => item.slug === slug);
            return (
              <span key={slug} className="chip chip-active px-2.5 py-1 text-[0.72rem]">
                {category?.short ?? slug}
              </span>
            );
          })}
          {(filters.min || filters.max) && (
            <span className="chip chip-active px-2.5 py-1 text-[0.72rem]">
              {filters.min || "0"} – {filters.max || "50.000.000"} TL
            </span>
          )}
          {filters.online && (
            <span className="chip chip-active px-2.5 py-1 text-[0.72rem]">Çevrimiçi satıcı</span>
          )}
          {filters.deals && (
            <span className="chip chip-active px-2.5 py-1 text-[0.72rem]">10+ işlem</span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="text-[0.72rem] font-medium text-muted-2 underline-offset-2 hover:text-text hover:underline"
          >
            Temizle
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="mt-6">
        {loadState === "loading" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="card overflow-hidden">
                <div className="aspect-square w-full animate-pulse bg-white/5" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-4/5 animate-pulse rounded bg-white/6" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-white/6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {loadState === "error" && (
          <div className="card border-danger/30 px-5 py-6">
            <h2 className="text-sm font-bold text-danger">İlanlar yüklenemedi</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Bağlantı kurulamadı. İnternetini kontrol edip sayfayı yenilemeyi dene.
            </p>
          </div>
        )}

        {loadState === "ready" && listings.length === 0 && (
          <div className="card flex flex-col items-center gap-4 px-5 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white/4 text-accent">
              <SearchIcon width={24} height={24} />
            </span>
            <div>
              <h2 className="text-base font-bold">
                {activeFilterCount > 0 || query
                  ? "Bu filtrelerle ilan bulunamadı"
                  : "Henüz ilan yok"}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-2">
                İlanları kullanıcılar oluşturur. İlk ilanı sen ver, satıcı olarak görünmeye
                başla.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/ilan/olustur" className="btn btn-primary h-10 px-4 text-sm">
                <PlusIcon width={16} height={16} /> İlan Oluştur
              </Link>
              {(activeFilterCount > 0 || query) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-ghost h-10 px-4 text-sm"
                >
                  Filtreleri temizle
                </button>
              )}
            </div>
          </div>
        )}

        {loadState === "ready" && listings.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { icon: <ShieldIcon width={15} height={15} />, text: "Güvenli alışveriş" },
            { icon: <BoltIcon width={15} height={15} />, text: "Hızlı iletişim" },
            { icon: <CheckIcon width={15} height={15} />, text: "Onaylı satıcılar" },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-2 rounded-xl border border-line-soft bg-white/3 px-3 py-2.5 text-xs text-muted"
            >
              <span className="text-accent">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Filtre paneli */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Filtreleri kapat"
          />
          <div className="animate-pop relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 pb-7 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Filtreler</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-2 hover:bg-white/5 hover:text-text"
                aria-label="Kapat"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">
                  Kategori (birden fazla seçilebilir)
                </p>
                <div className="flex flex-wrap gap-2">
                  {listingCategories.map((category) => {
                    const active = draft.categories.includes(category.slug);
                    return (
                      <button
                        key={category.slug}
                        type="button"
                        onClick={() => toggleCategory(category.slug)}
                        className={`chip ${active ? "chip-active" : ""}`}
                        aria-pressed={active}
                      >
                        <span aria-hidden>{category.icon}</span>
                        {category.short}
                        {active && <CheckIcon width={12} height={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">
                  Fiyat aralığı
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_LISTING_PRICE}
                    value={draft.min}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, min: event.target.value }))
                    }
                    placeholder="En az"
                    className="field"
                    aria-label="En az fiyat"
                  />
                  <span className="text-muted-2">–</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_LISTING_PRICE}
                    value={draft.max}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, max: event.target.value }))
                    }
                    placeholder="En fazla"
                    className="field"
                    aria-label="En fazla fiyat"
                  />
                </div>
                <p className="mt-1.5 text-[0.68rem] text-muted-2">
                  En fazla {MAX_LISTING_PRICE.toLocaleString("tr-TR")} TL
                </p>
              </div>

              <div className="space-y-2">
                <ToggleRow
                  label="Yalnızca çevrimiçi satıcılar"
                  description="Şu an sitede aktif olan satıcılar"
                  checked={draft.online}
                  onChange={(checked) => setDraft((prev) => ({ ...prev, online: checked }))}
                />
                <ToggleRow
                  label="Yalnızca Onaylı Satıcılar"
                  description="Mavi tikli, onaydan geçmiş satıcılar"
                  checked={draft.verified}
                  onChange={(checked) => setDraft((prev) => ({ ...prev, verified: checked }))}
                />
                <ToggleRow
                  label="10+ başarılı işlem sahibi satıcı"
                  description="En az 10 onaylı satışı olanlar"
                  checked={draft.deals}
                  onChange={(checked) => setDraft((prev) => ({ ...prev, deals: checked }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearFilters} className="btn btn-ghost h-11 flex-1">
                  Temizle
                </button>
                <button type="button" onClick={applyDraft} className="btn btn-primary h-11 flex-[2]">
                  Filtrele
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
        checked
          ? "border-accent/50 bg-accent/10"
          : "border-line-soft bg-white/3 hover:border-line"
      }`}
      aria-pressed={checked}
    >
      <span className="min-w-0">
        <span className="block text-[0.82rem] font-semibold">{label}</span>
        <span className="block text-[0.68rem] text-muted-2">{description}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-accent" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-[1.4rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
