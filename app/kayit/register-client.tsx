"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { RegisterForm } from "@/components/auth/register-form";
import { DemoBanner } from "@/components/demo-banner";
import { safeNextPath } from "@/lib/navigation";

export function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath ?? "/panel");
    }
  }, [loading, user, nextPath, router]);

  return (
    <AuthShell
      eyebrow="Ücretsiz hesap"
      title="Kayıt ol"
      subtitle="Dört alan, otuz saniye. Sonrasında her şey elinin altında."
    >
      <DemoBanner />
      <RegisterForm nextPath={nextPath} />
    </AuthShell>
  );
}
