"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.3h12.5c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.4-4.1 6.6-10.1 6.6-17.4Z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.5-5.9l-7.6-5.9c-2 1.4-4.7 2.4-7.9 2.4-6.4 0-11.7-3.8-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48Z"
      />
    </svg>
  );
}

/** Google ile giriş / kayıt butonu (Supabase OAuth) */
export function GoogleButton({
  label,
  nextPath,
}: {
  label: string;
  nextPath?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase bağlantısı bulunamadı.");
      return;
    }
    setPending(true);

    const next = nextPath || "/ilanlar";
    const redirectTo = `${window.location.origin}${BASE}/oauth/?next=${encodeURIComponent(next)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });

    if (oauthError) {
      setError(
        /provider is not enabled|not supported/i.test(oauthError.message)
          ? "Google girişi Supabase'de henüz açık değil."
          : "Google ile giriş başlatılamadı. Lütfen tekrar dene.",
      );
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void start()}
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white/6 text-[0.95rem] font-semibold text-text transition hover:bg-white/10 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Spinner /> Google'a yönlendiriliyor…
          </>
        ) : (
          <>
            <GoogleIcon /> {label}
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
