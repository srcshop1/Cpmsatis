import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { SellerShowcaseClient } from "./seller-client";

export const metadata: Metadata = { title: "Satıcı Vitrini" };

export default function SellerPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <SellerShowcaseClient />
    </Suspense>
  );
}
