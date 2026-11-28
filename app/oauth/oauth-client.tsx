"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { safeNextPath } from "@/lib/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Google dönüşü: Supabase kod değişimini kendisi yapar,
 * burada oturumun oturmasını bekleyip hedef sayfaya geçilir.
 */
export function OAuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const nextPath = safeNextPath(searchParams.get("next")) ?? "/ilanlar";

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error_description=")) {
      setError("Google girişi iptal edildi veya tamamlanamadı.");
      return;
    }
    if (!supabase) {
      setError("Supabase bağlantısı bulunamadı.");
      return;
    }

    let cancelled = false;
    let tries = 0;

    const finish = () => {
      if (!cancelled) router.replace(nextPath);
    };

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        finish();
        return;
      }
      tries += 1;
      if (tries > 40) {
        if (!cancelled) {
          setError("Oturum açılamadı. Lütfen giriş sayfasından tekrar dene.");
        }
        return;
      }
      window.setTimeout(() => void check(), 250);
    };

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, nextPath, router]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="text-lg font-extrabold">Giriş tamamlanamadı</h1>
        <p className="text-sm leading-relaxed text-muted-2">{error}</p>
        <Link href="/giris" className="btn btn-primary h-11 px-5 text-sm">
          Giriş sayfasına dön
        </Link>
      </main>
    );
  }

  return <AuthPageLoading />;
}
