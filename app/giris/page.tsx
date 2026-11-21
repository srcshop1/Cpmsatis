import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { DemoBanner } from "@/components/demo-banner";
import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/navigation";

export const metadata: Metadata = { title: "Giriş Yap" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/panel");

  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

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
