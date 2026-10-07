import { site } from "@/lib/site";
import { getPublishedContent } from "@/lib/public-data";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, ch => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  }[ch] || ch));
}

export async function GET() {
  const items = await getPublishedContent(50);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>ResetWatch</title>
<link>${site.url}</link>
<description>${escapeXml(site.description)}</description>
<language>zh-CN</language>
${items.map(item => `<item>
<title>${escapeXml(item.title)}</title>
<link>${site.url}/insights/${encodeURIComponent(item.slug)}</link>
<guid>${site.url}/insights/${encodeURIComponent(item.slug)}</guid>
<description>${escapeXml(item.excerpt)}</description>
${item.publishedAt ? `<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>` : ""}
</item>`).join("\n")}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600"
    }
  });
}
