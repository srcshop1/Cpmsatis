import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { PanelClient } from "./panel-client";

export const metadata: Metadata = { title: "Panelim" };

export default function PanelPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <PanelClient />
    </Suspense>
  );
}
