import { authMode } from "@/lib/auth";

export function DemoBanner() {
  if (authMode === "supabase") return null;

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/8 px-3.5 py-2.5 text-[0.72rem] leading-relaxed text-accent-soft/90">
      <span className="mt-0.5 text-sm leading-none" aria-hidden>
        ⚡
      </span>
      <p>
        <span className="font-semibold">Demo modu:</span> Supabase anahtarları eklenmediği için
        hesaplar bu sunucuda saklanıyor. Gerçek veritabanı için{" "}
        <code className="rounded bg-black/25 px-1 py-0.5 text-[0.68rem]">SUPABASE-KURULUM.md</code>{" "}
        dosyasını takip et.
      </p>
    </div>
  );
}
