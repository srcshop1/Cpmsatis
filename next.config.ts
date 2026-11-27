import type { NextConfig } from "next";

// GitHub Pages'te site /Cpmsatis alt yolundan yayınlanır.
const isPages = process.env.GITHUB_PAGES === "true";
const repoName = "Cpmsatis";

// Alt yol: proje adresinde /Cpmsatis, kendi alan adında kök.
// NEXT_PUBLIC_BASE_PATH verilirse o kullanılır ("" = kök alan adı).
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH !== undefined
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : isPages
      ? `/${repoName}`
      : "";

const nextConfig: NextConfig = {
  // GitHub Pages için statik dışa aktarım
  ...(isPages
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath ? `${basePath}/` : "",
        trailingSlash: true,
      }
    : {}),
  env: {
    // Alt yol bilgisi istemci tarafında da gerekli (PWA, service worker)
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: { unoptimized: true },
  // Önizleme ortamı (e2b proxy) dev varlıklarına erişebilsin
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  experimental: {
    // Sunucu action'larında makul bir gövde limiti
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
