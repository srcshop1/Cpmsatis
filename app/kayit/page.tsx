import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { DemoBanner } from "@/components/demo-banner";
import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/navigation";

export const metadata: Metadata = { title: "Kayıt Ol" };

export default async function RegisterPage({
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
      eyebrow="Ücretsiz hesap"
      title="Kayıt Ol"
      subtitle="Dört alan, otuz saniye. Sonrasında her şey elinin altında."
    >
      <DemoBanner />
      <RegisterForm nextPath={nextPath} />
    </AuthShell>
  );
}
