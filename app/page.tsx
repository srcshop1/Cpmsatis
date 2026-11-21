import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  GridIcon,
  HeadsetIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
} from "@/components/icons";
import { getSessionUser } from "@/lib/auth";
import { categories, demoListings, formatPrice } from "@/lib/catalog";

export default async function HomePage() {
  const user = await getSessionUser();
  const featured = demoListings.slice(0, 4);

  return (
    <div className="relative min-h-screen overflow-hidden bg-aurora">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] grid-lines opacity-80" />

      <div className="relative">
        <SiteHeader user={user} />

        <main>
          {/* HERO */}
          <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:pt-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="animate-fade-up">
                <span className="badge border border-accent/30 bg-accent/10 text-accent-soft">
                  <SparkIcon width={13} height={13} />
                  Dijital pazar yeri · güvenli & hızlı
                </span>

                <h1 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-[3.4rem]">
                  Aradığın her şey,
                  <br />
                  <span className="bg-gradient-to-r from-accent-soft via-accent to-accent-deep bg-clip-text text-transparent">
                    tek dokunuş uzağında.
                  </span>
                </h1>

                <p className="mt-4 max-w-lg text-[0.98rem] leading-relaxed text-muted sm:text-base">
                  Oyun hesapları, oyun içi ürünler, abonelikler ve dijital hizmetler tek yerde.
                  Ara, bul, güvenle satın al — teslimat dakikalar içinde.
                </p>

                <form
                  action="/panel"
                  className="mt-7 flex items-center gap-2 rounded-2xl border border-line bg-surface/90 p-1.5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur"
                >
                  <span className="pl-2.5 text-muted-2">
                    <SearchIcon width={19} height={19} />
                  </span>
                  <input
                    name="q"
                    type="search"
                    placeholder="Ne arıyorsun? Valorant hesabı, Steam key…"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-[#5d667a]"
                    aria-label="İlan ara"
                  />
                  <button type="submit" className="btn btn-primary h-11 shrink-0 px-4 text-sm">
                    Ara
                    <ArrowRightIcon width={16} height={16} />
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] text-muted-2">Popüler:</span>
                  {["Valorant", "PUBG UC", "Steam key", "Abonelik"].map((term) => (
                    <Link
                      key={term}
                      href={`/panel?q=${encodeURIComponent(term)}`}
                      className="chip px-3 py-1.5 text-[0.75rem]"
                    >
                      {term}
                    </Link>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.78rem] text-muted">
                  {[
                    { icon: <ShieldIcon width={15} height={15} />, label: "Güvenli ödeme" },
                    { icon: <BoltIcon width={15} height={15} />, label: "Anında teslim" },
                    { icon: <HeadsetIcon width={15} height={15} />, label: "7/24 destek" },
                  ].map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1.5">
                      <span className="text-mint">{item.icon}</span>
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Görsel önizleme */}
              <div className="relative hidden lg:block" aria-hidden>
                <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_30%,rgba(255,138,31,0.2),transparent_70%)] blur-2xl" />
                <div className="card relative space-y-3 p-4">
                  <div className="flex items-center justify-between border-b border-line-soft pb-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
                      <GridIcon width={14} height={14} /> Günün fırsatları
                    </span>
                    <span className="badge border border-mint/25 bg-mint/10 text-[0.65rem] text-mint">
                      canlı önizleme
                    </span>
                  </div>

                  {demoListings.slice(0, 3).map((listing) => (
                    <div
                      key={listing.id}
                      className="flex items-center gap-3 rounded-xl border border-line-soft bg-white/3 p-2.5"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/30 text-xl">
                        {listing.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.82rem] font-semibold">
                          {listing.title}
                        </span>
                        <span className="text-[0.7rem] text-muted-2">
                          @{listing.seller} · ★ {listing.rating.toFixed(1)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[0.85rem] font-bold text-accent">
                        {formatPrice(listing.price)}
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2.5 text-[0.72rem] text-accent-soft">
                    <CheckIcon width={15} height={15} />
                    Ödeme onaylanana kadar tutar güvende.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* KATEGORİLER */}
          <section id="kategoriler" className="mx-auto w-full max-w-6xl px-4 py-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Kategoriler</h2>
                <p className="mt-1 text-sm text-muted">Tek tıkla istediğin alana atla.</p>
              </div>
              <Link
                href="/panel"
                className="hidden items-center gap-1 text-sm font-semibold text-accent hover:text-accent-soft sm:inline-flex"
              >
                Tümünü gör <ArrowRightIcon width={15} height={15} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/panel?kategori=${category.slug}`}
                  className="card card-hover group flex items-center gap-3 p-3.5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-black/25 text-xl transition group-hover:border-accent/40">
                    {category.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{category.name}</span>
                    <span className="block truncate text-[0.7rem] text-muted-2">
                      {category.blurb}
                    </span>
                  </span>
                  <ArrowRightIcon
                    width={15}
                    height={15}
                    className="ml-auto shrink-0 text-muted-2 transition group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </Link>
              ))}
            </div>
          </section>

          {/* ÖNE ÇIKANLAR */}
          <section className="mx-auto w-full max-w-6xl px-4 py-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Öne çıkan ilanlar</h2>
                <p className="mt-1 text-sm text-muted">
                  Popüler ürünler · <span className="text-muted-2">örnek içerik</span>
                </p>
              </div>
              <Link
                href="/panel"
                className="hidden items-center gap-1 text-sm font-semibold text-accent hover:text-accent-soft sm:inline-flex"
              >
                Keşfete geç <ArrowRightIcon width={15} height={15} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {featured.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>

          {/* NASIL ÇALIŞIR */}
          <section id="nasil" className="mx-auto w-full max-w-6xl px-4 py-10">
            <div className="card relative overflow-hidden p-6 sm:p-9">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">3 adımda alışveriş</h2>
              <p className="mt-1 text-sm text-muted">Kayıt ol, ara, satın al. Bu kadar.</p>

              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Ücretsiz kayıt ol",
                    text: "Kullanıcı adı, e-posta ve şifre. 30 saniyede hesabın hazır.",
                    icon: <UserIcon width={18} height={18} />,
                  },
                  {
                    step: "02",
                    title: "Ara ve seç",
                    text: "Tek arama kutusu, net filtreler. Aradığını hemen bul.",
                    icon: <SearchIcon width={18} height={18} />,
                  },
                  {
                    step: "03",
                    title: "Güvenle satın al",
                    text: "Ödeme onaylanınca ürün anında teslim edilir.",
                    icon: <ShieldIcon width={18} height={18} />,
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-xl border border-line-soft bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/4 text-accent">
                        {item.icon}
                      </span>
                      <span className="text-lg font-extrabold text-white/10">{item.step}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-2">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* GÜVENLİK */}
          <section id="guvenlik" className="mx-auto w-full max-w-6xl px-4 py-10">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: <ShieldIcon width={18} height={18} />,
                  title: "Güvenli alışveriş",
                  text: "Ödeme, ürün teslim edilene kadar güvencede tutulur.",
                },
                {
                  icon: <BoltIcon width={18} height={18} />,
                  title: "Hızlı teslim",
                  text: "Dijital ürünlerin çoğu anında teslim edilir.",
                },
                {
                  icon: <HeadsetIcon width={18} height={18} />,
                  title: "7/24 destek",
                  text: "Sorun olduğunda destek ekibi yanında.",
                },
                {
                  icon: <GridIcon width={18} height={18} />,
                  title: "Kolay kullanım",
                  text: "Karmaşık menüler yok; her şey elinin altında.",
                },
              ].map((item) => (
                <div key={item.title} className="card p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/12 text-accent">
                    {item.icon}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-2">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="mx-auto w-full max-w-6xl px-4 py-10 pb-16">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-accent/25 bg-gradient-to-br from-accent/16 via-surface-2 to-surface p-7 text-center sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,138,31,0.18),transparent_70%)]" />
              <div className="relative">
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {user ? "Her şey hazır, hadi keşfet." : "Hesabın yok mu? 30 saniyede aç."}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  {user
                    ? "Panelinde arama, kategoriler ve siparişlerin seni bekliyor."
                    : "Kayıt olmak ücretsiz. İlanları gör, güvenle alışverişe başla."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  {user ? (
                    <Link href="/panel" className="btn btn-primary h-11 px-6">
                      Panelime git <ArrowRightIcon width={16} height={16} />
                    </Link>
                  ) : (
                    <>
                      <Link href="/kayit" className="btn btn-primary h-11 px-6">
                        Ücretsiz Kayıt Ol
                      </Link>
                      <Link href="/giris" className="btn btn-ghost h-11 px-6">
                        Giriş Yap
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-line-soft/70 bg-ink/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-extrabold tracking-tight">
                CPM<span className="text-accent">Satış</span>
              </p>
              <p className="mt-1 text-xs text-muted-2">
                Güvenli dijital alışveriş platformu · Demo arayüz
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-2">
              <Link href="/#kategoriler" className="transition hover:text-text">
                Kategoriler
              </Link>
              <Link href="/#nasil" className="transition hover:text-text">
                Nasıl çalışır?
              </Link>
              <Link href="/kayit" className="transition hover:text-text">
                Kayıt Ol
              </Link>
              <Link href="/giris" className="transition hover:text-text">
                Giriş Yap
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
