import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Önizleme ortamı (e2b proxy) dev varlıklarına erişebilsin
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  experimental: {
    // Sunucu action'larında makul bir gövde limiti
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
