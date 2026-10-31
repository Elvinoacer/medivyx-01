import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://medivyx.co.ke"
  return ["", "/catalog", "/services"].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path ? "weekly" : "daily", priority: path ? 0.8 : 1 }))
}
