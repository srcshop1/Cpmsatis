"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MoneyIcon } from "@/components/price";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CheckIcon,
  ChevronLeftIcon,
  ImagePlusIcon,
  SparkIcon,
  XIcon,
} from "@/components/icons";
import {
  MAX_LISTING_IMAGES,
  MAX_LISTING_PRICE,
  MAX_LISTING_TITLE,
  listingCategories,
} from "@/lib/catalog";
import {
  LISTINGS_TABLE,
  LISTING_IMAGES_BUCKET,
  applyDiscount,
  cancelDiscount,
  discountOf,
  loadDiscountQuota,
  type DiscountQuota,
} from "@/lib/listings";
import { censorProfanity } from "@/lib/profanity";
import { sanitizeHtml } from "@/lib/sanitize";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export function EditListingClient() {
  const searchParams = useSearchParams();
  const listingId = searchParams?.get("id") ?? "";
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<"loading" | "ready" | "missing" | "denied">("loading");
  const [images, setImages] = useState<string[]>([]);
  const [picked, setPicked] = useState<{ file: File; url: string }[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState<number | null>(null);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [quota, setQuota] = useState<DiscountQuota | null>(null);
  const [discountPrice, setDiscountPrice] = useState("");
  const [discountBusy, setDiscountBusy] = useState(false);
  const [discountNote, setDiscountNote] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("");

  useEffect(() => {
    if (!supabase || !listingId || loading) return;
    let cancelled = false;

    void (async () => {
      const { data, error: loadError } = await supabase
        .from(LISTINGS_TABLE)
        .select("id,title,price,previous_price,categories,category,images,description_html,seller_id")
        .eq("id", listingId)
        .maybeSingle();

      if (cancelled) return;
      if (loadError || !data) {
        setState("missing");
        return;
      }

      const row = data as unknown as {
        id: string;
        title: string;
        price: number;
        categories: string[] | null;
        category: string;
        images: string[] | null;
        description_html: string | null;
        seller_id: string;
        previous_price: number | null;
      };

      if (!user || row.seller_id !== user.id) {
        setState("denied");
        return;
      }

      setTitle(row.title);
      setPrice(String(row.price));
      setOldPrice(Number(row.price));
      setOriginalPrice(row.previous_price ? Number(row.previous_price) : null);
      setImages(row.images ?? []);
      setCategories(
        row.categories && row.categories.length > 0 ? row.categories : [row.category].filter(Boolean),
      );
      setState("ready");

      const current = await loadDiscountQuota(supabase);
      if (!cancelled) setQuota(current);

      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeHtml(row.description_html ?? "");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, listingId, user, loading]);

  const SIZE_PX: Record<string, string> = {
    "1": "10px",
    "2": "13px",
    "3": "16px",
    "4": "18px",
    "5": "24px",
    "6": "32px",
    "7": "40px",
  };

  /** Tarayıcının <font> etiketlerini kalıcı <span style> hâline çevirir */
  function normalizeFontTags() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll("font").forEach((node) => {
      const span = document.createElement("span");
      const styles: string[] = [];
      const size = node.getAttribute("size");
      const face = node.getAttribute("face");
      const color = node.getAttribute("color");
      if (size && SIZE_PX[size]) styles.push(`font-size:${SIZE_PX[size]}`);
      if (face) styles.push(`font-family:${face.replace(/["']/g, "")}`);
      if (color) styles.push(`color:${color}`);
      if (styles.length > 0) span.setAttribute("style", styles.join("; "));
      while (node.firstChild) span.appendChild(node.firstChild);
      node.replaceWith(span);
    });
  }

  function exec(command: string, value?: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    normalizeFontTags();
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: { file: File; url: string }[] = [];
    for (const file of Array.from(files)) {
      if (images.length + picked.length + next.length >= MAX_LISTING_IMAGES) break;
      if (!file.type.startsWith("image/")) {
        setError("Sadece görsel dosyaları yükleyebilirsin.");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("Her görsel en fazla 8 MB olabilir.");
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    if (next.length > 0) setPicked((prev) => [...prev, ...next]);
  }

  function makeCover(url: string) {
    setImages((prev) => [url, ...prev.filter((item) => item !== url)]);
  }

  async function applyNow() {
    if (!supabase || discountBusy) return;
    const value = Number(discountPrice);
    const base = originalPrice ?? Number(price);
    if (!discountPrice || Number.isNaN(value) || value <= 0) {
      setDiscountNote("Geçerli bir indirimli fiyat gir.");
      return;
    }
    if (value >= base) {
      setDiscountNote("İndirimli fiyat, mevcut fiyattan düşük olmalı.");
      return;
    }
    setDiscountBusy(true);
    setDiscountNote(null);
    const result = await applyDiscount(supabase, listingId, Math.round(value));
    setDiscountBusy(false);
    if (result.error) {
      setDiscountNote(result.error);
      return;
    }
    setOriginalPrice(base);
    setPrice(String(Math.round(value)));
    setOldPrice(Math.round(value));
    setQuota(result.quota);
    setDiscountPrice("");
    setDiscountNote("İndirim uygulandı.");
  }

  async function removeDiscount() {
    if (!supabase || discountBusy || originalPrice === null) return;
    setDiscountBusy(true);
    setDiscountNote(null);
    const error = await cancelDiscount(supabase, listingId);
    setDiscountBusy(false);
    if (error) {
      setDiscountNote(error);
      return;
    }
    setPrice(String(originalPrice));
    setOldPrice(originalPrice);
    setOriginalPrice(null);
    setDiscountNote("İndirim kaldırıldı.");
  }

  async function save() {
    setError(null);
    const cleanTitle = title.trim();

    if (cleanTitle.length < 5) {
      setError("Başlık en az 5 karakter olmalı.");
      return;
    }
    if (categories.length === 0) {
      setError("En az 1 kategori seçmelisin.");
      return;
    }
    const numericPrice = Number(price);
    if (!price || Number.isNaN(numericPrice) || numericPrice < 0) {
      setError("Geçerli bir fiyat gir.");
      return;
    }
    if (numericPrice > MAX_LISTING_PRICE) {
      setError(`Fiyat en fazla ${MAX_LISTING_PRICE.toLocaleString("tr-TR")} CPM olabilir.`);
      return;
    }
    const descriptionHtml = censorProfanity(sanitizeHtml(editorRef.current?.innerHTML ?? ""));
    if (!descriptionHtml || descriptionHtml.length < 10) {
      setError("Açıklama en az 10 karakter olmalı.");
      return;
    }
    if (!supabase || !user) {
      setError("Bağlantı kurulamadı. Sayfayı yenileyip tekrar dene.");
      return;
    }

    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const image of picked) {
        setStep("Görseller yükleniyor…");
        const safeName = image.file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-40);
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(LISTING_IMAGES_BUCKET)
          .upload(path, image.file, { cacheControl: "31536000", upsert: false });
        if (uploadError) throw new Error("Görsel yüklenemedi. Lütfen tekrar dene.");
        const { data: publicUrl } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path);
        uploaded.push(publicUrl.publicUrl);
      }

      setStep("İlan güncelleniyor…");
      const { error: updateError } = await supabase
        .from(LISTINGS_TABLE)
        .update({
          title: censorProfanity(cleanTitle),
          description_html: descriptionHtml,
          price: Math.round(numericPrice),
          category: categories[0],
          categories,
          images: [...images, ...uploaded],
        })
        .eq("id", listingId)
        .eq("seller_id", user.id);

      if (updateError) throw new Error(updateError.message);

      picked.forEach((image) => URL.revokeObjectURL(image.url));
      router.push(`/ilan/goruntule?id=${listingId}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "İlan güncellenemedi. Sayfayı yenileyip tekrar dene.",
      );
    } finally {
      setSaving(false);
      setStep("");
    }
  }


  return (
    <AppShell>
      <Link
        href={`/ilan/goruntule?id=${listingId}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-2 transition hover:text-text"
      >
        <ChevronLeftIcon width={14} height={14} /> İlana dön
      </Link>

      <h1 className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl">İlanı Düzenle</h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">
        Fiyatı değiştirebilir, dilersen indirim uygulayabilirsin. İndirimin aylık hakkı var.
      </p>

      {state === "loading" && (
        <div className="mt-4 space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
        </div>
      )}

      {state === "missing" && (
        <div className="mt-4 card px-5 py-10 text-center">
          <p className="text-sm font-bold">İlan bulunamadı</p>
          <Link href="/ilanlar" className="btn btn-primary mt-4 h-10 px-5 text-sm">
            İlanlara dön
          </Link>
        </div>
      )}

      {state === "denied" && (
        <div className="mt-4 card px-5 py-10 text-center">
          <p className="text-sm font-bold">Bu ilanı düzenleyemezsin</p>
          <p className="mt-1 text-xs text-muted-2">Sadece kendi ilanlarını düzenleyebilirsin.</p>
        </div>
      )}

      {state === "ready" && (
        <div className="mt-4 space-y-4">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Görseller</h2>
              <span className="text-[0.68rem] text-muted-2">
                {images.length + picked.length}/{MAX_LISTING_IMAGES}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {images.map((url, index) => (
                <div
                  key={url}
                  className="relative aspect-square overflow-hidden rounded-xl border border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute left-1.5 top-1.5 badge border border-black/30 bg-black/60 text-[0.55rem] text-white">
                      Kapak
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeCover(url)}
                      className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.55rem] font-semibold text-white"
                    >
                      Kapak yap
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((item) => item !== url))}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white transition hover:bg-danger"
                    aria-label="Görseli kaldır"
                  >
                    <XIcon width={12} height={12} />
                  </button>
                </div>
              ))}

              {picked.map((image) => (
                <div
                  key={image.url}
                  className="relative aspect-square overflow-hidden rounded-xl border border-accent/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 badge border border-black/30 bg-accent/80 text-[0.52rem] font-bold text-ink">
                    YENİ
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(image.url);
                      setPicked((prev) => prev.filter((item) => item.url !== image.url));
                    }}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white transition hover:bg-danger"
                    aria-label="Görseli kaldır"
                  >
                    <XIcon width={12} height={12} />
                  </button>
                </div>
              ))}

              {images.length + picked.length < MAX_LISTING_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-white/3 text-muted-2 transition hover:border-accent/50 hover:text-accent"
                >
                  <ImagePlusIcon width={22} height={22} />
                  <span className="text-[0.62rem]">Görsel ekle</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between">
              <label htmlFor="edit-title" className="text-sm font-bold">
                Başlık
              </label>
              <span className="text-[0.68rem] text-muted-2">
                {title.length}/{MAX_LISTING_TITLE}
              </span>
            </div>
            <input
              id="edit-title"
              className="field mt-2"
              maxLength={MAX_LISTING_TITLE}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-bold">Açıklama</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1 rounded-t-xl border border-line bg-surface-2/60 p-1.5">
              <button
                type="button"
                onClick={() => exec("bold")}
                className="grid h-7 w-7 place-items-center rounded-md border border-line bg-ink text-[0.75rem] font-bold text-muted hover:text-text"
                title="Kalın"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => exec("italic")}
                className="grid h-7 w-7 place-items-center rounded-md border border-line bg-ink text-[0.75rem] italic text-muted hover:text-text"
                title="İtalik"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => exec("underline")}
                className="grid h-7 w-7 place-items-center rounded-md border border-line bg-ink text-[0.75rem] underline text-muted hover:text-text"
                title="Altı çizili"
              >
                U
              </button>
              <span className="mx-1 h-5 w-px bg-line" />
              {["#eef2f8", "#ff8a1f", "#35d49a", "#6c8cff", "#ff5c6c"].map((color) => (
                <button
                  key={color}
                  type="button"
                  title={`Renk ${color}`}
                  onClick={() => exec("foreColor", color)}
                  className="h-5 w-5 rounded-full border border-white/20"
                  style={{ backgroundColor: color }}
                  aria-label={`Metin rengi ${color}`}
                />
              ))}
              <span className="mx-1 h-5 w-px bg-line" />
              <select
                className="h-7 rounded-md border border-line bg-ink px-1.5 text-[0.7rem] text-muted outline-none"
                onChange={(event) => exec("fontSize", event.target.value)}
                value="3"
                aria-label="Yazı boyutu"
              >
                <option value="2">Küçük</option>
                <option value="3">Normal</option>
                <option value="5">Büyük</option>
                <option value="6">Çok büyük</option>
              </select>
              <select
                className="h-7 rounded-md border border-line bg-ink px-1.5 text-[0.7rem] text-muted outline-none"
                onChange={(event) => exec("fontName", event.target.value)}
                value=""
                aria-label="Yazı tipi"
              >
                <option value="">Yazı tipi</option>
                <option value="DejaVu Sans, Arial, sans-serif">Sade</option>
                <option value="Georgia, 'Times New Roman', serif">Serif</option>
                <option value="'Courier New', monospace">Mono</option>
                <option value="Verdana, Geneva, sans-serif">Verdana</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
              </select>
            </div>
            <div
              ref={editorRef}
              contentEditable
              onContextMenu={(event) => event.preventDefault()}
              suppressContentEditableWarning
              data-placeholder="İlan açıklaması…"
              className="rich-editor min-h-32 w-full rounded-b-xl border border-t-0 border-line bg-ink/70 p-3 text-sm leading-relaxed outline-none focus:border-accent/60 [&:empty]:before:text-muted-2 [&:empty]:before:content-[attr(data-placeholder)]"
            />
            <p className="mt-1.5 text-[0.62rem] leading-relaxed text-muted-2">
              Araçlar imlecin bulunduğu yerden sonrasına uygulanır. Telefonda metin seçme menüsü
              kapalıdır.
            </p>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-bold">Fiyat ve kategori</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-price" className="mb-1.5 block text-xs text-muted">
                  Fiyat
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2">
                    <MoneyIcon size={15} />
                  </span>
                  <input
                    id="edit-price"
                    className="field pl-9 pr-14"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_LISTING_PRICE}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.66rem] font-semibold text-muted-2">
                    CPM
                  </span>
                </div>

              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted">Kategori</p>
                <div className="flex flex-wrap gap-1.5">
                  {listingCategories.map((item) => {
                    const active = categories.includes(item.slug);
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        onClick={() =>
                          setCategories((prev) =>
                            prev.includes(item.slug)
                              ? prev.filter((slug) => slug !== item.slug)
                              : [...prev, item.slug],
                          )
                        }
                        className={`chip px-2.5 py-1 text-[0.7rem] ${active ? "chip-active" : ""}`}
                      >
                        <span aria-hidden>{item.icon}</span>
                        {item.short}
                        {active && <CheckIcon width={11} height={11} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">İndirim</h2>
              {quota && (
                <span className="text-[0.64rem] text-muted-2">
                  {quota.limit < 0
                    ? "Sınırsız hak"
                    : `Bu ay ${quota.used}/${quota.limit} kullandın`}
                </span>
              )}
            </div>

            {(() => {
              const discount = discountOf({
                price: Number(price),
                previous_price: originalPrice,
              });
              return discount ? (
                <div className="mt-2 rounded-xl border border-mint/40 bg-mint/10 px-3 py-2">
                  <p className="text-[0.7rem] font-semibold text-mint">
                    %{discount.percent} indirimde · eski fiyat{" "}
                    {discount.original.toLocaleString("tr-TR")} CPM
                  </p>
                  <button
                    type="button"
                    onClick={() => void removeDiscount()}
                    disabled={discountBusy}
                    className="mt-1.5 rounded-lg border border-line bg-black/25 px-2 py-1 text-[0.64rem] font-semibold text-muted disabled:opacity-50"
                  >
                    İndirimi kaldır
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-[0.66rem] text-muted-2">
                  İndirim uygularsan ilanda “%X indirim” etiketi çıkar.
                </p>
              );
            })()}

            <div className="mt-2 flex gap-1.5">
              <input
                className="field h-10 text-[0.8rem]"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="İndirimli fiyat (CPM)"
                value={discountPrice}
                onChange={(event) => setDiscountPrice(event.target.value)}
              />
              <button
                type="button"
                onClick={() => void applyNow()}
                disabled={
                  discountBusy ||
                  (quota !== null && quota.remaining !== null && quota.remaining <= 0)
                }
                className="shrink-0 rounded-xl border border-mint/40 bg-mint/12 px-3 text-[0.72rem] font-semibold text-mint disabled:opacity-50"
              >
                {discountBusy ? "…" : "İndirim yap"}
              </button>
            </div>

            {quota !== null && quota.remaining !== null && quota.remaining <= 0 && (
              <p className="mt-1 text-[0.64rem] text-[#ffb3bb]">
                Bu ayki indirim hakkın doldu. Gelecek ay yenilenir.
              </p>
            )}

            {discountNote && <p className="mt-1 text-[0.66rem] text-accent">{discountNote}</p>}
          </section>

          {error && (
            <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-[#ffb3bb]">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn btn-primary h-12 w-full text-base disabled:opacity-60"
          >
            {saving ? (
              <>
                <SparkIcon width={17} height={17} /> {step || "Kaydediliyor…"}
              </>
            ) : (
              <>
                <CheckIcon width={17} height={17} /> Değişiklikleri Kaydet
              </>
            )}
          </button>
        </div>
      )}
    </AppShell>
  );
}
