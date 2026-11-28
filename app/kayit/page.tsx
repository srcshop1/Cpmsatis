import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { RegisterPageClient } from "./register-client";

export const metadata: Metadata = { title: "Kayıt ol" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <RegisterPageClient />
    </Suspense>
  );
}
