import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Sunucu action'larında makul bir gövde limiti
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
