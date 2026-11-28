import { ShieldIcon } from "@/components/icons";

/**
 * Sorumluluk reddi.
 * "full": ana sayfa altı / ilan detayı · "compact": tüm sayfaların altında ince şerit
 */
export function Disclaimer({ variant = "full" }: { variant?: "full" | "compact" }) {
  if (variant === "compact") {
    return (
      <p className="mx-auto mt-6 max-w-3xl px-1 text-center text-[0.63rem] leading-relaxed text-muted-2">
        CPM Satış yalnızca ilan panosudur. Satış, ödeme ve teslimat alıcı ile satıcı arasındadır;
        site ödeme almaz, komisyon almaz, aracılık yapmaz. Dolandırılma veya anlaşmazlık
        durumunda site hiçbir sorumluluk kabul etmez.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-[#ffb057]/30 bg-[#ffb057]/8 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-[#ffb057]">
          <ShieldIcon width={17} height={17} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.78rem] font-bold text-[#ffc98a]">Sorumluluk reddi</p>
          <p className="mt-1 text-[0.72rem] leading-relaxed text-muted">
            Bu site yalnızca ilan panosudur. Satış, ödeme ve teslimat tamamen alıcı ile satıcı
            arasındadır. Site ödeme almaz, komisyon almaz, aracılık yapmaz. Dolandırılma, ürünün
            verilmemesi, eksik/yanlış ürün veya herhangi bir anlaşmazlık durumunda
            <strong className="text-text"> CPM Satış hiçbir sorumluluk kabul etmez</strong>.
            Anlaşmayı kendin yap, karşı tarafı kontrol et, gerekirse yetkililere bildir.
          </p>
        </div>
      </div>
    </div>
  );
}
