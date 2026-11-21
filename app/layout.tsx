import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CPM Satış — Dijital alışverişin en kolay hali",
    template: "%s · CPM Satış",
  },
  description:
    "Oyun hesapları, oyun içi ürünler, abonelikler ve dijital hizmetler. Ara, bul, güvenle satın al.",
};

export const viewport: Viewport = {
  themeColor: "#07090d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
