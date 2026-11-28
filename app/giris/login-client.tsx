"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { LoginForm } from "@/components/auth/login-form";
import { DemoBanner } from "@/components/demo-banner";
import { safeNextPath } from "@/lib/navigation";

export function LoginPageClient() {
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
      eyebrow="Tekrar hoş geldin"
      title="Giriş Yap"
      subtitle="Kullanıcı adın veya e-posta adresinle saniyeler içinde devam et."
    >
      <DemoBanner />
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
