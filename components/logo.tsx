const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={`${BASE}/`}
      className="group flex items-center gap-2.5"
      aria-label="CPM Satış ana sayfa"
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-soft to-accent-deep text-ink shadow-[0_8px_22px_-10px_rgba(255,138,31,0.9)]">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2.7 20 7v10l-8 4.3L4 17V7l8-4.3Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="m8 12.2 2.8 2.8 5.4-5.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span className="hidden text-[1.05rem] font-extrabold tracking-tight text-text min-[380px]:inline">
          CPM<span className="text-accent">Satış</span>
        </span>
      )}
    </a>
  );
}
