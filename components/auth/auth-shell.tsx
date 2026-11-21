import type { ReactNode } from "react";
import { BoltIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-aurora">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-70" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-stretch gap-10 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-12">
        {/* Sol taraf: marka paneli */}
        <section className="hidden flex-col justify-between rounded-[1.7rem] border border-line/80 bg-gradient-to-b from-surface-2/90 to-surface/70 p-9 lg:flex">
          <Logo />

          <div className="animate-fade-up">
            <span className="badge border border-accent/30 bg-accent/10 text-accent-soft">
              <SparkIcon width={13} height={13} /> Dijital pazarın tek adresi
            </span>
            <h1 className="mt-5 text-[2.6rem] font-extrabold leading-[1.08] tracking-tight">
              Her şey
              <br />
              <span className="bg-gradient-to-r from-accent-soft via-accent to-accent-deep bg-clip-text text-transparent">
                elinin altında.
              </span>
            </h1>
            <p className="mt-4 max-w-sm text-[0.98rem] leading-relaxed text-muted">
              Oyun hesabından aboneliğe, lisanstan dijital hizmete — aradığını ara, güvenle
              satın al. Tek tıkla, dakikalar içinde.
            </p>

            <ul className="mt-8 space-y-3.5">
              {[
                {
                  icon: <ShieldIcon width={18} height={18} />,
                  title: "Güvenli alışveriş",
                  text: "Ödeme onaylanana kadar para güvende tutulur.",
                },
                {
                  icon: <BoltIcon width={18} height={18} />,
                  title: "Anında teslim",
                  text: "Dijital ürünler saniyeler içinde elinde olur.",
                },
                {
                  icon: <SparkIcon width={18} height={18} />,
                  title: "Basit arayüz",
                  text: "Tek arama kutusu, tek tık. Karmaşa yok.",
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white/4 text-accent">
                    {item.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="block text-xs leading-relaxed text-muted-2">
                      {item.text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-white/3 px-4 py-3">
            <div className="flex -space-x-2">
              {["A", "M", "E", "S"].map((letter, index) => (
                <span
                  key={letter}
                  className="grid h-7 w-7 place-items-center rounded-full border border-surface bg-gradient-to-br from-[#2a3345] to-[#161b25] text-[0.65rem] font-bold text-muted"
                  style={{ zIndex: 4 - index }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-2">
              <span className="font-semibold text-text">9.000+ kullanıcı</span> aramızda. Sen de
              katıl.
            </p>
          </div>
        </section>

        {/* Sağ taraf: form */}
        <section className="flex flex-col justify-center">
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo />
          </div>

          <div className="card animate-pop mx-auto w-full max-w-[27rem] p-6 sm:p-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>

            <div className="mt-6">{children}</div>
          </div>

          <p className="mx-auto mt-5 max-w-[27rem] text-center text-[0.7rem] leading-relaxed text-muted-2">
            © {new Date().getFullYear()} CPM Satış · Güvenli dijital alışveriş platformu
          </p>
        </section>
      </div>
    </main>
  );
}
