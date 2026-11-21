import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { DemoBanner } from "@/components/demo-banner";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  GridIcon,
  MessageIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  WalletIcon,
} from "@/components/icons";
import { getSessionUser } from "@/lib/auth";
import { categories, demoListings } from "@/lib/catalog";

export const metadata: Metadata = { title: "Panelim" };

type PanelSearchParams = {
  q?: string;
  kategori?: string;
  hosgeldin?: string;
};

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<PanelSearchParams>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;

  if (!user) {
    const nextParams = new URLSearchParams();
    if (params.q) nextParams.set("q", params.q);
    if (params.kategori) nextParams.set("kategori", params.kategori);
    const nextQuery = nextParams.toString();
    redirect(`/giris${nextQuery ? `?next=${encodeURIComponent(`/panel?${nextQuery}`)}` : ""}`);
  }

  const query = (params.q ?? "").trim();
  const activeCategory = categories.find((category) => category.slug === params.kategori);

  const visibleListings = demoListings.filter((listing) => {
    const matchesQuery = query
      ? `${listing.title} ${listing.category} ${listing.seller}`
          .toLocaleLowerCase("tr")
          .includes(query.toLocaleLowerCase("tr"))
      : true;
    const matchesCategory = activeCategory ? listing.category === activeCategory.name : true;
    return matchesQuery && matchesCategory;
  });

  const quickActions = [
    { icon: <PlusIcon width={18} height={18} />, label: "İlan Ver", hint: "Yakında" },
    { icon: <GridIcon width={18} height={18} />, label: "Siparişlerim", hint: "0 sipariş" },
    { icon: <MessageIcon width={18} height={18} />, label: "Mesajlar", hint: "Yakında" },
    { icon: <WalletIcon width={18} height={18} />, label: "Cüzdan", hint: "0,00 ₺" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-aurora">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] grid-lines opacity-60" />

      <div className="relative">
        <SiteHeader user={user} />

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
          <DemoBanner />

          {params.hosgeldin === "1" && (
            <div className="animate-pop mb-4 flex items-center gap-2.5 rounded-xl border border-mint/25 bg-mint/8 px-4 py-3 text-sm text-mint">
              <CheckIcon width={17} height={17} />
              <span>
                Hoş geldin <span className="font-semibold">{user.username}</span>! Hesabın hazır,
                her şey elinin altında.
              </span>
            </div>
          )}

          {/* Karşılama + arama */}
          <section className="card relative overflow-hidden p-5 sm:p-7">
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/12 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
                    <SparkIcon width={12} height={12} /> Panelin
                  </p>
                  <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">
                    Selam, {user.username} 👋
                  </h1>
                  <p className="mt-1 text-sm text-muted">
                    Ne aradığını yaz, gerisini bize bırak.
                  </p>
                </div>

                <span className="badge border border-line bg-white/4 px-2.5 py-1 text-[0.68rem] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                  {user.email}
                </span>
              </div>

              <form
                action="/panel"
                className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-ink/80 p-1.5"
              >
                <span className="pl-2.5 text-muted-2">
                  <SearchIcon width={19} height={19} />
                </span>
                <input
                  name="q"
                  type="search"
                  defaultValue={query}
                  placeholder="Ürün, kategori veya satıcı ara…"
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-[#5d667a]"
                  aria-label="İlan ara"
                />
                <button type="submit" className="btn btn-primary h-11 shrink-0 px-4 text-sm">
                  Ara
                </button>
              </form>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="group flex items-center gap-2.5 rounded-xl border border-line-soft bg-white/3 px-3 py-2.5 text-left transition hover:border-accent/35 hover:bg-white/5"
                    title="Bu bölüm sonraki adımda eklenecek"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/25 text-accent">
                      {action.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8rem] font-semibold">
                        {action.label}
                      </span>
                      <span className="block truncate text-[0.65rem] text-muted-2">
                        {action.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Kategori şeridi */}
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted">Kategoriler</h2>
              <Link
                href="/#kategoriler"
                className="text-xs font-medium text-muted-2 transition hover:text-text"
              >
                Tümü
              </Link>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <Link
                href={query ? `/panel?q=${encodeURIComponent(query)}` : "/panel"}
                className={`chip ${!activeCategory ? "chip-active" : ""}`}
              >
                <GridIcon width={14} height={14} /> Tümü
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/panel?kategori=${category.slug}${
                    query ? `&q=${encodeURIComponent(query)}` : ""
                  }`}
                  className={`chip ${activeCategory?.slug === category.slug ? "chip-active" : ""}`}
                >
                  <span aria-hidden>{category.icon}</span>
                  {category.name}
                </Link>
              ))}
            </div>
          </section>

          {/* Sonuçlar */}
          <section className="mt-6 pb-14">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                  {activeCategory ? activeCategory.name : query ? `"${query}" için sonuçlar` : "Sana önerilenler"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-2">
                  {visibleListings.length} ürün listeleniyor · örnek içerik
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/3 px-2.5 py-1.5 text-[0.7rem] text-muted">
                <BoltIcon width={13} height={13} className="text-mint" /> En hızlı teslim
              </span>
            </div>

            {visibleListings.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {visibleListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-white/4 text-accent">
                  <SearchIcon width={22} height={22} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Aradığını bulamadık</h3>
                  <p className="mt-1 text-xs text-muted-2">
                    Farklı bir kelime dene ya da kategorilere göz at.
                  </p>
                </div>
                <Link href="/panel" className="btn btn-ghost h-9 px-4 text-xs">
                  Filtreleri temizle <ArrowRightIcon width={14} height={14} />
                </Link>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
