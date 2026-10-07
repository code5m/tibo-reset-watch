import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { query } from "@/lib/db";

const staticRoutes = [
  "",
  "/reset",
  "/projects",
  "/guides",
  "/guides/codex-reset",
  "/guides/banked-reset",
  "/guides/timezone",
  "/pricing",
  "/subscribe",
  "/faq",
  "/about",
  "/privacy",
  "/status"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const dynamic = await query<any>(
    "select slug, updated_at from content_items where status='published' order by updated_at desc limit 500"
  );

  return [
    ...staticRoutes.map(path => ({
      url: site.url + path,
      lastModified: now,
      changeFrequency: path === "/reset" || path === "/projects" ? "hourly" as const : "weekly" as const,
      priority: path === "" ? 1 : path === "/reset" ? 0.9 : 0.7
    })),
    ...dynamic.map(item => ({
      url: site.url + "/insights/" + item.slug,
      lastModified: new Date(item.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7
    }))
  ];
}
