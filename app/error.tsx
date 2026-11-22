"use client";

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sayfa]", error?.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-aurora px-5 py-16">
      <div className="mx-auto max-w-md card p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white/4 text-2xl">
          ⚠️
        </span>
        <h1 className="mt-4 text-base font-bold">Sayfa yüklenemedi</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-2">
          Sayfayı yenilemek genellikle sorunu çözer. Sorun sürerse birkaç dakika sonra tekrar dene.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="btn btn-ghost h-10 flex-1 text-sm"
          >
            Tekrar dene
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary h-10 flex-1 text-sm"
          >
            Yenile
          </button>
        </div>
      </div>
    </div>
  );
}
