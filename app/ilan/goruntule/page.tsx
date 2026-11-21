import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { ListingDetailClient } from "./detail-client";

export const metadata: Metadata = { title: "İlan" };

export default function ListingDetailPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <ListingDetailClient />
    </Suspense>
  );
}
