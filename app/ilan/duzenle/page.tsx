import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { EditListingClient } from "./edit-client";

export const metadata: Metadata = { title: "İlanı Düzenle" };

export default function EditListingPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <EditListingClient />
    </Suspense>
  );
}
