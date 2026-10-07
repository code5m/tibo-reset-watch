import { query } from "@/lib/db";
import type { ContentItem, ProjectLead, Signal } from "@/lib/types";

export async function getSignals(limit = 20): Promise<Signal[]> {
  const rows = await query<any>(
    `select id, source, source_post_id, kind, title, body, source_url,
            source_created_at, reset_at, created_at
       from signals
      order by source_created_at desc
      limit $1`,
    [limit]
  );

  return rows.map(row => ({
    id: row.id,
    source: row.source,
    sourcePostId: row.source_post_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    sourceUrl: row.source_url,
    sourceCreatedAt: row.source_created_at,
    resetAt: row.reset_at,
    createdAt: row.created_at
  }));
}

export async function getProjectLeads(limit = 20): Promise<ProjectLead[]> {
  const rows = await query<any>(
    `select id, source_post_id, title, summary, source_url, score,
            tags, source_created_at, created_at
       from project_leads
      order by source_created_at desc
      limit $1`,
    [limit]
  );

  return rows.map(row => ({
    id: row.id,
    sourcePostId: row.source_post_id,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    score: row.score,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sourceCreatedAt: row.source_created_at,
    createdAt: row.created_at
  }));
}

export async function getPublishedContent(limit = 20): Promise<ContentItem[]> {
  const rows = await query<any>(
    `select id, title, slug, excerpt, body, content_type, status,
            published_at, created_at
       from content_items
      where status = 'published'
      order by published_at desc nulls last
      limit $1`,
    [limit]
  );

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    contentType: row.content_type,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at
  }));
}
