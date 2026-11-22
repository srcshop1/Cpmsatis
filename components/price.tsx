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
      <path
        d="M12 6.4v11.2M14.9 9c-.7-.8-1.7-1.2-2.9-1.2-1.8 0-3.1.9-3.1 2.2 0 3.1 6 1.4 6 4.4 0 1.4-1.4 2.3-3.2 2.3-1.3 0-2.5-.5-3.2-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
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
