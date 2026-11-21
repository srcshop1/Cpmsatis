import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { ListingsClient } from "./listings-client";

export const metadata: Metadata = { title: "İlanlar" };

export default function ListingsPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <ListingsClient />
    </Suspense>
  );
}
