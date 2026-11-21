import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageLoading } from "@/components/auth/auth-page-loading";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = { title: "Sohbet" };

export default function ChatPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <ChatClient />
    </Suspense>
  );
}
