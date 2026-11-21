"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MessageIcon,
  ShieldIcon,
  StarIcon,
  XIcon,
} from "@/components/icons";
import { formatPrice } from "@/lib/catalog";
import { LISTINGS_TABLE, categoryLabel, type ListingSeller } from "@/lib/listings";
import { sanitizeHtml } from "@/lib/sanitize";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Detail = {
  id: string;
  title: string;
  description_html: string | null;
  price: number;
  category: string;
  images: string[] | null;
  created_at: string;
  featured_until: string | null;
  seller_id: string;
};

export function ListingDetailClient() {
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [listing, setListing] = useState<Detail | null>(null);
  const [seller, setSeller] = useState<ListingSeller | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (!supabase || !params?.id) {
      setState("error");
      setError("Supabase bağlantısı yok.");
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error: queryError } = await supabase
        .from(LISTINGS_TABLE)
        .select(
          "id,title,description_html,price,category,images,created_at,featured_until,seller_id",
        )
        .eq("id", params.id)
        .maybeSingle();

      if (cancelled) return;
      if (queryError) {
        setState("error");
        setError(queryError.message);
        return;
      }
      if (!data) {
        setState("missing");
        return;
      }

      setListing(data as Detail);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, sales_count, rating, last_seen_at")
        .eq("id", (data as Detail).seller_id)
        .maybeSingle();

      if (cancelled) return;
      setSeller((profile as ListingSeller) ?? null);
      setState("ready");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, params?.id]);

  return (
    <AppShell>
      <Link
        href="/ilanlar"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> İlanlar
      </Link>

      {state === "loading" && (
        <div className="mt-4 space-y-3">
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-white/5" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-white/6" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/6" />
        </div>
      )}

      {state === "missing" && (
        <div className="mt-5 card px-6 py-14 text-center">
          <h1 className="text-base font-bold">İlan bulunamadı</h1>
          <p className="mt-1.5 text-sm text-muted-2">Kaldırılmış ya da hiç var olmamış olabilir.</p>
          <Link href="/ilanlar" className="btn btn-primary mt-4 h-10 px-5 text-sm">
            İlanlara dön
          </Link>
        </div>
      )}

      {state === "error" && (
        <div className="mt-5 card border-danger/30 px-5 py-6">
          <h1 className="text-sm font-bold text-danger">İlan yüklenemedi</h1>
          <p className="mt-1.5 break-words text-xs text-muted">{error}</p>
        </div>
      )}

      {state === "ready" && listing && (
        <div className="mt-4 space-y-4">
          {/* Galeri */}
          <div className="relative overflow-hidden rounded-2xl border border-line bg-black/40">
            <div className="relative">
              {listing.images && listing.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.images[index]}
                  alt={listing.title}
                  className="max-h-[520px] w-full object-contain"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center text-4xl text-muted-2">
                  🖼️
                </div>
              )}

              {listing.featured_until && new Date(listing.featured_until) > new Date() && (
                <span className="absolute left-3 top-3 badge border border-accent/40 bg-accent/90 text-[0.65rem] font-bold text-ink">
                  <StarIcon width={11} height={11} /> ÖNE ÇIKAN
                </span>
              )}

              {listing.images && listing.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((prev) =>
                        prev === 0 ? listing.images!.length - 1 : prev - 1,
                      )
                    }
                    className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
                    aria-label="Önceki görsel"
                  >
                    <ChevronLeftIcon width={18} height={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((prev) =>
                        prev === listing.images!.length - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
                    aria-label="Sonraki görsel"
                  >
                    <ChevronRightIcon width={18} height={18} />
                  </button>
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[0.65rem] text-white">
                    {index + 1}/{listing.images.length}
                  </span>
                </>
              )}
            </div>

            {listing.images && listing.images.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto border-t border-line p-2">
                {listing.images.map((image, imageIndex) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setIndex(imageIndex)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${
                      imageIndex === index ? "border-accent" : "border-line"
                    }`}
                    aria-label={`Görsel ${imageIndex + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bilgi */}
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="badge border border-line bg-white/4 text-[0.62rem] text-muted">
                  {categoryLabel(listing.category)}
                </span>
                <h1 className="mt-2 text-lg font-extrabold leading-snug sm:text-xl">
                  {listing.title}
                </h1>
              </div>
              <p className="shrink-0 text-xl font-extrabold text-accent">
                {formatPrice(listing.price)}
              </p>
            </div>

            <p className="mt-2 inline-flex items-center gap-1 text-[0.68rem] text-muted-2">
              <ClockIcon width={12} height={12} />
              {new Date(listing.created_at).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Satıcı */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-accent-soft to-accent-deep text-lg font-extrabold text-ink">
                {seller?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (seller?.username ?? "?").charAt(0).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">@{seller?.username ?? "satıcı"}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-2">
                  <span className="inline-flex items-center gap-1 text-mint">
                    <CheckIcon width={12} height={12} />
                    {seller?.sales_count ?? 0} başarılı işlem
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <StarIcon width={11} height={11} className="text-accent" />
                    {seller?.rating ? Number(seller.rating).toFixed(1) : "—"}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="btn btn-primary mt-3 h-11 w-full"
            >
              <MessageIcon width={17} height={17} /> Satıcı ile İletişime Geç
            </button>
            <p className="mt-2 flex items-start gap-1.5 text-[0.65rem] leading-relaxed text-muted-2">
              <ShieldIcon width={12} height={12} className="mt-0.5 shrink-0" />
              Sitede ödeme alınmaz. Anlaşmayı mesajlaşarak kendin yaparsın.
            </p>
          </div>

          {/* Açıklama */}
          <div className="card p-4">
            <h2 className="text-sm font-bold">Açıklama</h2>
            {listing.description_html ? (
              <div
                className="prose-cpms mt-2 text-[0.85rem] leading-relaxed text-muted [&_b]:text-text [&_strong]:text-text"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(listing.description_html) }}
              />
            ) : (
              <p className="mt-2 text-sm text-muted-2">Açıklama eklenmemiş.</p>
            )}
          </div>

          {/* Değerlendirmeler */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Değerlendirmeler</h2>
              <span className="text-[0.68rem] text-muted-2">0 değerlendirme</span>
            </div>
            <div className="mt-3 flex gap-1.5">
              <span className="chip chip-active px-2.5 py-1 text-[0.7rem]">Bu ilan</span>
              <span className="chip px-2.5 py-1 text-[0.7rem]">Tümü</span>
            </div>
            <p className="mt-3 text-sm text-muted-2">
              Henüz değerlendirme yok. Onaylanan satışlardan sonra alıcılar puan verir.
            </p>
          </div>
        </div>
      )}

      {/* İletişim modalı */}
      {contactOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setContactOpen(false)}
            aria-label="Kapat"
          />
          <div className="animate-pop relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Satıcıya mesaj</h2>
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-2 hover:bg-white/5 hover:text-text"
                aria-label="Kapat"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white/3 p-2">
              {listing?.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.images[0]}
                  alt=""
                  className="h-11 w-11 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-[0.78rem] font-semibold">{listing?.title}</p>
                <p className="text-[0.68rem] text-muted-2">
                  {listing ? formatPrice(listing.price) : ""}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-line-soft bg-ink/70 p-3">
              <p className="text-[0.72rem] font-semibold text-accent">Şu ilanla ilgileniyorum;</p>
              <p className="mt-1 text-sm text-muted">Merhaba, bu ilan hâlâ satılık mı?</p>
            </div>

            <Link
              href="/mesajlar"
              className="btn btn-primary mt-3 h-11 w-full"
              onClick={() => setContactOpen(false)}
            >
              Sohbete git
            </Link>
            <p className="mt-2 text-center text-[0.65rem] text-muted-2">
              Mesajlaşma bir sonraki güncellemede aktif olacak; ilan otomatik olarak sohbete
              eklenecek.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
