import type { Metadata, Viewport } from "next";
import { AppErrorGuard } from "@/components/app-error-guard";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://srcshop1.github.io/Cpmsatis"
).replace(/\/$/, "");
const SITE_NAME = "CPM Satış";
const SITE_DESC =
  "CPM araç, çizim ve hesap alım-satımı. İlan ver, filtrele, satıcıyla mesajlaşarak anlaş.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — CPM araç, çizim ve hesap alım-satımı`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  keywords: ["CPM", "CPM satış", "CPM ilan", "çizim", "araç", "hesap satış", "takas"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — CPM araç, çizim ve hesap alım-satımı`,
    description: SITE_DESC,
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — CPM ilan pazarı`,
    description: SITE_DESC,
  },
  robots: { index: true, follow: true },
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
        <AppErrorGuard />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
