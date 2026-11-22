import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://srcshop1.github.io/Cpmsatis").replace(/\/$/, "");

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/ilanlar", priority: 0.9 },
    { path: "/diger", priority: 0.6 },
    { path: "/durum", priority: 0.5 },
    { path: "/giris", priority: 0.5 },
    { path: "/kayit", priority: 0.5 },
  ];

  return routes.map((route) => ({
    url: `${BASE}${route.path}/`,
    lastModified: now,
    changeFrequency: "daily",
    priority: route.priority,
  }));
}
