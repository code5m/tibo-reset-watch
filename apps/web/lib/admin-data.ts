import { query, queryOne } from "@/lib/db";

export async function getDashboardMetrics() {
  const [subscribers, signals, projects, campaigns, deliveries] = await Promise.all([
    queryOne<any>("select count(*)::int as count from subscribers where status = 'active'"),
    queryOne<any>("select count(*)::int as count from signals"),
    queryOne<any>("select count(*)::int as count from project_leads"),
    queryOne<any>("select count(*)::int as count from campaigns"),
    queryOne<any>("select count(*)::int as count from deliveries where status = 'sent'")
  ]);

  return {
    subscribers: subscribers?.count || 0,
    signals: signals?.count || 0,
    projects: projects?.count || 0,
    campaigns: campaigns?.count || 0,
    deliveries: deliveries?.count || 0
  };
}

export async function getSubscribers(limit = 100) {
  return query<any>(
    `select id, email, phone, wechat_target, alipay_target, name, status, channels, interests, source, created_at
       from subscribers
      order by created_at desc
      limit $1`,
    [limit]
  );
}

export async function getContentItems(limit = 100) {
  return query<any>(
    `select id, title, slug, excerpt, content_type, status, published_at, created_at
       from content_items
      order by created_at desc
      limit $1`,
    [limit]
  );
}

export async function getCampaigns(limit = 100) {
  return query<any>(
    `select id, title, audience, channels, status, scheduled_at, sent_at, created_at
       from campaigns
      order by created_at desc
      limit $1`,
    [limit]
  );
}
