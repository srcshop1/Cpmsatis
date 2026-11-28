import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { OAuthClient } from "./oauth-client";

export const metadata: Metadata = { title: "Giriş" };

export default function OAuthPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <OAuthClient />
    </Suspense>
  );
}
