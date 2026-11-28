import { formatPrice } from "@/lib/catalog";

export function MoneyIcon({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="5.4" stroke="currentColor" strokeWidth="1.3" opacity="0.75" />
      <path d="M12 9.6v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Fiyatı para ikonu + sayı olarak gösterir */
export function Price({
  value,
  className = "",
  iconSize = 13,
}: {
  value: number;
  className?: string;
  iconSize?: number;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <MoneyIcon size={iconSize} />
      {formatPrice(value)}
    </span>
  );
}
