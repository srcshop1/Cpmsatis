"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

type Check = { name: string; ok: boolean; detail: string };

export default function StatusPage() {
  const { user, loading } = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const results: Check[] = [];

    results.push({
      name: "Ortam değişkenleri",
      ok: isSupabaseConfigured,
      detail: isSupabaseConfigured ? SUPABASE_URL : "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY yok",
    });

    try {
      const stored = localStorage.getItem("cpms_last_auth_error");
      setLastError(stored);
    } catch {
      /* yoksay */
    }

    const run = async () => {
      if (!supabase) {
        setChecks(results);
        setRunning(false);
        return;
      }

      try {
        const { data: session } = await supabase.auth.getSession();
        results.push({
          name: "Auth oturumu",
          ok: true,
          detail: session.session?.user?.email ?? "oturum yok (normal)",
        });
      } catch (error) {
        results.push({
          name: "Auth oturumu",
          ok: false,
          detail: error instanceof Error ? error.message : "bilinmeyen hata",
        });
      }

      const { error: profilesError } = await supabase.from("profiles").select("id").limit(1);
      results.push({
        name: "profiles tablosu",
        ok: !profilesError,
        detail: profilesError?.message ?? "ok",
      });

      const { error: rpcError } = await supabase.rpc("email_for_username", { uname: "__probe__" });
      results.push({
        name: "email_for_username fonksiyonu",
        ok: !rpcError,
        detail: rpcError?.message ?? "ok",
      });

      const { error: listingsError } = await supabase.from("listings").select("id").limit(1);
      results.push({
        name: "listings tablosu",
        ok: !listingsError,
        detail: listingsError?.message ?? "ok",
      });

      const { error: storageError } = await supabase.storage
        .from("listing-images")
        .list("", { limit: 1 });
      results.push({
        name: "listing-images depolama alanı",
        ok: !storageError,
        detail: storageError?.message ?? "ok",
      });

      setChecks(results);
      setRunning(false);
    };

    void run();
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10">
      <h1 className="text-xl font-extrabold tracking-tight">Bağlantı Teşhisi</h1>
      <p className="mt-1 text-xs text-muted-2">
        Supabase bağlantısını ve tabloları bu sayfadan kontrol edebilirsin.
      </p>

      <div className="card mt-5 divide-y divide-line-soft p-0">
        {(running ? [] : checks).map((check) => (
          <div key={check.name} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${
                check.ok ? "bg-mint/15 text-mint" : "bg-danger/15 text-danger"
              }`}
            >
              {check.ok ? "✓" : "✕"}
            </span>
            <div className="min-w-0">
              <p className="text-[0.82rem] font-semibold">{check.name}</p>
              <p className="mt-0.5 break-words text-[0.7rem] text-muted-2">{check.detail}</p>
            </div>
          </div>
        ))}
        {running && <p className="px-4 py-6 text-sm text-muted">Kontrol ediliyor…</p>}
      </div>

      <div className="card mt-4 p-4">
        <p className="text-sm font-bold">Oturum</p>
        <p className="mt-1 break-words text-[0.72rem] text-muted-2">
          {loading ? "yükleniyor…" : user ? `${user.username} · ${user.email}` : "giriş yapılmamış"}
        </p>
      </div>

      {lastError && (
        <div className="card mt-4 p-4">
          <p className="text-sm font-bold">Son giriş/kayıt hatası</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2.5 text-[0.68rem] leading-relaxed text-[#ffb3bb]">
            {lastError}
          </pre>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/kayit" className="btn btn-primary h-10 px-4 text-sm">
          Kayıt ekranı
        </Link>
        <Link href="/giris" className="btn btn-ghost h-10 px-4 text-sm">
          Giriş ekranı
        </Link>
        <button
          type="button"
          onClick={() => location.reload()}
          className="btn btn-ghost h-10 px-4 text-sm"
        >
          Yenile
        </button>
      </div>
    </main>
  );
}
