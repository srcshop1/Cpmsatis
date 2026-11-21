"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CheckIcon,
  ImagePlusIcon,
  SparkIcon,
  StarIcon,
  XIcon,
} from "@/components/icons";
import {
  MAX_LISTING_IMAGES,
  MAX_LISTING_PRICE,
  MAX_LISTING_TITLE,
  listingCategories,
} from "@/lib/catalog";
import { LISTINGS_TABLE, LISTING_IMAGES_BUCKET } from "@/lib/listings";
import { sanitizeHtml } from "@/lib/sanitize";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type PickedImage = { file: File; url: string };

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export default function CreateListingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<PickedImage[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [wantsFeatured, setWantsFeatured] = useState(false);
  const [featuredDays, setFeaturedDays] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("");

  function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: PickedImage[] = [];
    for (const file of Array.from(files)) {
      if (images.length + next.length >= MAX_LISTING_IMAGES) break;
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
    if (next.length > 0) setImages((prev) => [...prev, ...next].slice(0, MAX_LISTING_IMAGES));
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return copy;
    });
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  async function submit() {
    setError(null);
    const cleanTitle = title.trim();

    if (cleanTitle.length < 5) {
      setError("Başlık en az 5 karakter olmalı.");
      return;
    }
    if (cleanTitle.length > MAX_LISTING_TITLE) {
      setError(`Başlık en fazla ${MAX_LISTING_TITLE} karakter olabilir.`);
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
      setError(`Fiyat en fazla ${MAX_LISTING_PRICE.toLocaleString("tr-TR")} ₺ olabilir.`);
      return;
    }
    const descriptionHtml = sanitizeHtml(editorRef.current?.innerHTML ?? "");
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
      const uploadedUrls: string[] = [];
      for (const image of images) {
        setStep("Görseller yükleniyor…");
        const safeName = image.file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-40);
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(LISTING_IMAGES_BUCKET)
          .upload(path, image.file, { cacheControl: "31536000", upsert: false });

        if (uploadError) {
          console.error("[gorsel]", uploadError.message);
          throw new Error("Görsel yüklenemedi. Lütfen tekrar dene.");
        }
        const { data: publicUrl } = supabase.storage
          .from(LISTING_IMAGES_BUCKET)
          .getPublicUrl(path);
        uploadedUrls.push(publicUrl.publicUrl);
      }

      setStep("İlan kaydediliyor…");
      const { data, error: insertError } = await supabase
        .from(LISTINGS_TABLE)
        .insert({
          seller_id: user.id,
          title: cleanTitle,
          description_html: descriptionHtml,
          price: Math.round(numericPrice),
          category: categories[0],
          categories,
          images: uploadedUrls,
          status: "active",
          featured_requested: wantsFeatured,
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (wantsFeatured && data?.id) {
        setStep("Öne çıkarma talebi gönderiliyor…");
        await supabase.from("featured_requests").insert({
          listing_id: data.id,
          seller_id: user.id,
          days: featuredDays,
        });
      }

      setStep("Tamamlandı!");
      images.forEach((image) => URL.revokeObjectURL(image.url));
      router.push(`/ilan/goruntule?id=${data.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "İlan oluşturulamadı. Sayfayı yenileyip tekrar dene.",
      );
    } finally {
      setSaving(false);
      setStep("");
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">İlan Oluştur</h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">
        Görseller, başlık, açıklama ve fiyat — hepsi tek ekranda.
      </p>

      <div className="mt-5 space-y-4">
        {/* Görseller */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Görseller (isteğe bağlı)</h2>
            <span className="text-[0.68rem] text-muted-2">
              {images.length}/{MAX_LISTING_IMAGES}
            </span>
          </div>
          <p className="mt-1 text-[0.68rem] text-muted-2">
            İlk görsel kapak olur. Görsel eklemezsen ilanda boş bir çerçeve görünür, istediğin
            zaman ekleyebilirsin.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {images.map((image, index) => (
              <div
                key={image.url}
                className="relative aspect-square overflow-hidden rounded-xl border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-1.5 top-1.5 badge border border-black/30 bg-black/60 text-[0.55rem] text-white">
                    Kapak
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white transition hover:bg-danger"
                  aria-label="Görseli kaldır"
                >
                  <XIcon width={12} height={12} />
                </button>
              </div>
            ))}

            {images.length < MAX_LISTING_IMAGES && (
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

        {/* Başlık */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="listing-title" className="text-sm font-bold">
              İlan Başlığı
            </label>
            <span
              className={`text-[0.68rem] ${
                title.length > MAX_LISTING_TITLE - 10 ? "text-accent" : "text-muted-2"
              }`}
            >
              {title.length}/{MAX_LISTING_TITLE}
            </span>
          </div>
          <input
            id="listing-title"
            className="field mt-2"
            maxLength={MAX_LISTING_TITLE}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="ör. CPM 2 · 2 aylık hesap · 6 araç"
          />
        </section>

        {/* Açıklama */}
        <section className="card p-4">
          <h2 className="text-sm font-bold">Açıklama</h2>
          <p className="mt-1 text-[0.68rem] text-muted-2">
            Kalın, italik, altı çizili, renk ve boyut araçlarıyla zengin metin yaz.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1 rounded-t-xl border border-line bg-surface-2/60 p-1.5">
            <ToolButton label="B" title="Kalın" bold onClick={() => exec("bold")} />
            <ToolButton label="I" title="İtalik" italic onClick={() => exec("italic")} />
            <ToolButton label="U" title="Altı çizili" underline onClick={() => exec("underline")} />
            <span className="mx-1 h-5 w-px bg-line" />
            <select
              className="h-7 rounded-md border border-line bg-ink px-1.5 text-[0.7rem] text-muted outline-none"
              onChange={(event) => exec("fontSize", event.target.value)}
              defaultValue="3"
              aria-label="Yazı boyutu"
            >
              <option value="2">Küçük</option>
              <option value="3">Normal</option>
              <option value="5">Büyük</option>
              <option value="6">Çok büyük</option>
            </select>
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
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Ürününü detaylı anlat: ne var, ne yok, takas kabul eder misin?"
            className="min-h-32 w-full rounded-b-xl border border-t-0 border-line bg-ink/70 p-3 text-sm leading-relaxed outline-none focus:border-accent/60 [&:empty]:before:text-muted-2 [&:empty]:before:content-[attr(data-placeholder)]"
          />
        </section>

        {/* Fiyat + kategori */}
        <section className="card p-4">
          <h2 className="text-sm font-bold">Fiyat ve Kategori</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="listing-price" className="mb-1.5 block text-xs text-muted">
                Fiyat (₺)
              </label>
              <input
                id="listing-price"
                className="field"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_LISTING_PRICE}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0"
              />
              <p className="mt-1 text-[0.64rem] text-muted-2">
                En fazla {MAX_LISTING_PRICE.toLocaleString("tr-TR")} ₺ · sitede ödeme alınmaz
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-muted">
                Kategori <span className="text-danger">*</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {listingCategories.map((item) => {
                  const active = categories.includes(item.slug);
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      aria-pressed={active}
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
              <p className="mt-1 text-[0.64rem] text-muted-2">
                En az 1 kategori zorunlu · birden fazla seçebilirsin
              </p>
            </div>
          </div>
        </section>

        {/* Öne çıkar */}
        <section className="card p-4">
          <button
            type="button"
            onClick={() => setWantsFeatured((prev) => !prev)}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
              wantsFeatured ? "border-accent/50 bg-accent/10" : "border-line-soft bg-white/3"
            }`}
            aria-pressed={wantsFeatured}
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-black/25 text-accent">
                <StarIcon width={17} height={17} />
              </span>
              <span>
                <span className="block text-[0.85rem] font-semibold">İlanı Öne Çıkar</span>
                <span className="block text-[0.68rem] text-muted-2">
                  VIP/Premium hakkın varsa anında, yoksa yetkili onayıyla
                </span>
              </span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                wantsFeatured ? "bg-accent" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  wantsFeatured ? "left-[1.4rem]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {wantsFeatured && (
            <div className="mt-3">
              <p className="text-[0.7rem] text-muted-2">Kaç gün öne çıksın?</p>
              <div className="mt-1.5 flex gap-1.5">
                {[1, 3, 7].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setFeaturedDays(day)}
                    className={`chip ${featuredDays === day ? "chip-active" : ""}`}
                  >
                    {day} gün
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-2">
                VIP ayda 3, Premium ayda 1 ücretsiz öne çıkarma hakkına sahip. Hak yoksa
                talebin yetkili onayına düşer.
              </p>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-[#ffb3bb]">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="btn btn-primary h-12 w-full text-base disabled:opacity-60"
        >
          {saving ? (
            <>
              <SparkIcon width={17} height={17} /> {step || "Kaydediliyor…"}
            </>
          ) : (
            <>
              <CheckIcon width={17} height={17} /> İlanı Yayınla
            </>
          )}
        </button>

        <p className="pb-2 text-center text-[0.65rem] leading-relaxed text-muted-2">
          İlan yayınlandığında tüm kullanıcılar görebilir. Sitede ödeme alınmaz; anlaşma
          mesajlaşarak yapılır.
        </p>
      </div>
    </AppShell>
  );
}

function ToolButton({
  label,
  title,
  onClick,
  bold,
  italic,
  underline,
}: {
  label: string;
  title: string;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md border border-line bg-ink text-[0.75rem] text-muted transition hover:border-accent/50 hover:text-text ${
        bold ? "font-bold" : ""
      } ${italic ? "italic" : ""} ${underline ? "underline" : ""}`}
    >
      {label}
    </button>
  );
}
