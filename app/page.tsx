import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { CtaBand } from "@/components/home/cta-band";
import { HomeShowcase } from "@/components/home/showcase";
import { SiteHeader } from "@/components/site-header";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  GridIcon,
  HeadsetIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
} from "@/components/icons";
import { listingCategories } from "@/lib/catalog";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-aurora pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] grid-lines opacity-80" />

      <div className="relative">
        <SiteHeader />

        <main>
          {/* HERO */}
          <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 sm:pt-14">
            <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="animate-fade-up">
                <span className="badge border border-accent/30 bg-accent/10 text-accent-soft">
                  <SparkIcon width={13} height={13} />
                  Car Parking Multiplayer pazar yeri
                </span>

                <h1 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-[3.2rem]">
                  CPM dünyası,
                  <br />
                  <span className="bg-gradient-to-r from-accent-soft via-accent to-accent-deep bg-clip-text text-transparent">
                    tek dokunuş uzağında.
                  </span>
                </h1>

                <p className="mt-4 max-w-lg text-[0.98rem] leading-relaxed text-muted sm:text-base">
                  CPM 1 ve CPM 2 hesapları, takas, satılık, çizim ve krom ilanları. İlanı gör,
                  satıcıyla doğrudan konuş. Aracı yok, komisyon yok.
                </p>

                <form
                  action="/ilanlar"
                  className="mt-7 flex items-center gap-2 rounded-2xl border border-line bg-surface/90 p-1.5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur"
                >
                  <span className="pl-2.5 text-muted-2">
                    <SearchIcon width={19} height={19} />
                  </span>
                  <input
                    name="q"
                    type="search"
                    placeholder="Ne arıyorsun? CPM 2 hesap, krom, çizim…"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-[#5d667a]"
                    aria-label="İlan ara"
                  />
                  <button type="submit" className="btn btn-primary h-11 shrink-0 px-4 text-sm">
                    Ara
                    <ArrowRightIcon width={16} height={16} />
                  </button>
                </form>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <Link href="/ilan/olustur" className="btn btn-primary h-11 px-5">
                    <PlusIcon width={17} height={17} /> İlan Oluştur
                  </Link>
                  <Link href="/#nasil" className="btn btn-ghost h-11 px-5">
                    Nasıl çalışır?
                  </Link>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.78rem] text-muted">
                  {[
                    { icon: <ShieldIcon width={15} height={15} />, label: "Güvenli iletişim" },
                    { icon: <BoltIcon width={15} height={15} />, label: "Anında mesaj" },
                    { icon: <HeadsetIcon width={15} height={15} />, label: "Destek ekibi" },
                  ].map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1.5">
                      <span className="text-mint">{item.icon}</span>
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Örnek görünüm (sahte ilan yok) */}
              <div className="relative hidden lg:block">
                <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_30%,rgba(255,138,31,0.18),transparent_70%)] blur-2xl" />
                <div className="card relative p-4">
                  <div className="flex items-center justify-between border-b border-line-soft pb-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
                      <GridIcon width={14} height={14} /> İlanların görünümü
                    </span>
                    <span className="badge border border-line bg-white/4 text-[0.62rem] text-muted-2">
                      örnek
                    </span>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-line-soft bg-white/3">
                    <div className="relative grid aspect-square w-full place-items-center border-b border-line-soft bg-[radial-gradient(120%_120%_at_50%_-20%,rgba(255,138,31,0.14),transparent_60%)] text-muted-2">
                      <div className="flex flex-col items-center gap-2">
                        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-line text-2xl">
                          🖼️
                        </span>
                        <span className="text-xs">İlk ilanının görseli</span>
                      </div>
                      <span className="absolute left-2 top-2 badge border border-line bg-black/40 text-[0.6rem] text-muted">
                        CPM 2
                      </span>
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-4/5 rounded bg-white/10" />
                      <div className="h-3 w-1/3 rounded bg-accent/30" />
                      <div className="flex items-center gap-2 pt-1 text-[0.68rem] text-muted-2">
                        <span className="grid h-5 w-5 place-items-center rounded-md bg-white/8 text-[0.55rem] font-bold">
                          S
                        </span>
                        @satıcı · 0 işlem
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2.5 text-[0.72rem] text-accent-soft">
                    <CheckIcon width={15} height={15} />
                    İlanları kullanıcılar oluşturur — ilk ilan senin olsun.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <HomeShowcase />

          {/* KATEGORİLER */}
          <section id="kategoriler" className="mx-auto w-full max-w-6xl px-4 py-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Kategoriler</h2>
                <p className="mt-1 text-sm text-muted">
                  Tek tıkla filtrele, aradığını hemen bul.
                </p>
              </div>
              <Link
                href="/ilanlar"
                className="hidden items-center gap-1 text-sm font-semibold text-accent hover:text-accent-soft sm:inline-flex"
              >
                Tüm ilanlar <ArrowRightIcon width={15} height={15} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {listingCategories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/ilanlar?kategori=${category.slug}`}
                  className="card card-hover group flex items-center gap-3 p-3.5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-black/25 text-xl transition group-hover:border-accent/40">
                    {category.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{category.name}</span>
                    <span className="block truncate text-[0.7rem] text-muted-2">
                      {category.short} ilanları
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

          {/* NASIL ÇALIŞIR */}
          <section id="nasil" className="mx-auto w-full max-w-6xl px-4 py-10">
            <div className="card relative overflow-hidden p-6 sm:p-9">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">3 adımda</h2>
              <p className="mt-1 text-sm text-muted">
                Sitede ödeme yok; anlaşma satıcıyla doğrudan mesajlaşarak yapılır.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Ücretsiz kayıt ol",
                    text: "Kullanıcı adı, e-posta ve şifre. 30 saniyede hazır.",
                    icon: <UserIcon width={18} height={18} />,
                  },
                  {
                    step: "02",
                    title: "İlan ver ya da ilanı bul",
                    text: "Kategori, fiyat ve satıcı filtreleriyle aradığını bul.",
                    icon: <SearchIcon width={18} height={18} />,
                  },
                  {
                    step: "03",
                    title: "Satıcıyla konuş",
                    text: "İlan üzerinden mesaj at, anlaşmanı yap.",
                    icon: <ShieldIcon width={18} height={18} />,
                  },
                ].map((item) => (
                  <div key={item.step} className="rounded-xl border border-line-soft bg-black/20 p-4">
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
                  title: "Güvenli iletişim",
                  text: "Mesajlar platform içinde kalır, engelle ve bildir hazır.",
                },
                {
                  icon: <BoltIcon width={18} height={18} />,
                  title: "Hızlı",
                  text: "Tek arama, tek dokunuş; filtrelerle saniyeler içinde bul.",
                },
                {
                  icon: <HeadsetIcon width={18} height={18} />,
                  title: "Destek",
                  text: "Destek talebi ve SSS ile her zaman yanındayız.",
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
            <CtaBand />
          </section>
        </main>

        <footer className="border-t border-line-soft/70 bg-ink/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-extrabold tracking-tight">
                CPM<span className="text-accent">Satış</span>
              </p>
              <p className="mt-1 text-xs text-muted-2">
                Car Parking Multiplayer ilan pazarı · Ödeme alınmaz, komisyon yok
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-2">
              <Link href="/ilanlar" className="transition hover:text-text">
                İlanlar
              </Link>
              <Link href="/diger/sss" className="transition hover:text-text">
                SSS
              </Link>
              <Link href="/diger/destek" className="transition hover:text-text">
                Destek
              </Link>
              <Link href="/kayit" className="transition hover:text-text">
                Kayıt Ol
              </Link>
            </div>
          </div>
        </footer>

        <BottomNav />
      </div>
    </div>
  );
}
