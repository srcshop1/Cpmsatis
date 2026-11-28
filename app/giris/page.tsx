import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { LoginPageClient } from "./login-client";

export const metadata: Metadata = { title: "Giriş yap" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <LoginPageClient />
    </Suspense>
  );
}
