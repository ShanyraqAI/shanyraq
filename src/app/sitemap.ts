import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();
  return [
    { url: new URL("/", siteUrl).toString(), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/register", siteUrl).toString(), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: new URL("/login", siteUrl).toString(), lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: new URL("/privacy", siteUrl).toString(), lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: new URL("/terms", siteUrl).toString(), lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
