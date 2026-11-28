import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { UserProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Kullanıcı profili" };

export default function UserProfilePage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <UserProfileClient />
    </Suspense>
  );
}
