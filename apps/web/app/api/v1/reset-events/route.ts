import { db } from "@/lib/db";
import { validateCatalog } from "@/public/workbench/reset-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Public, read-only event data. Never expose subscribers, credentials or provider errors.
const headers = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
export async function GET(request: Request) {
  const pool = db();
  if (!pool) return Response.json({ message: "未配置数据库；不能据此判断没有新 Reset。", availability: "unconfigured" }, { status: 503, headers });
  const params = new URL(request.url).searchParams;
  const limit = Number(params.get("limit") || 20);
  const offset = Number(params.get("offset") || 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(offset) || offset < 0 || offset > 200)
    return Response.json({ message: "分页参数不正确" }, { status: 400, headers });
  try {
    const [saved, pending] = await Promise.all([
      pool.query("select value, updated_at from app_settings where key=$1", ["resetwatch.catalog.v1"]),
      pool.query("select count(*)::int as count from signals")
    ]);
    const value = saved.rows[0]?.value;
    const catalog = validateCatalog(value?.catalog || { schemaVersion: 1, events: [] });
    const linked = new Set(catalog.events.flatMap(event => event.posts.map(post => post.id)));
    // An exact pending count cannot be obtained by subtracting counts: one post may have multiple signal kinds.
    const count = await pool.query("select count(distinct source_post_id)::int as count from signals where not(source_post_id=any($1::text[]))", [[...linked]]);
    const events = catalog.events.sort((a,b) => Date.parse(b.posts.at(-1)!.publishedAt) - Date.parse(a.posts.at(-1)!.publishedAt));
    return Response.json({
      schemaVersion: 1, serverTime: new Date().toISOString(),
      catalogUpdatedAt: saved.rows[0]?.updated_at || null,
      events: events.slice(offset, offset + limit),
      total: events.length, nextOffset: offset + limit < events.length ? offset + limit : null,
      pendingReviewCount: Number(count.rows[0]?.count || 0),
      sourceSignalCount: Number(pending.rows[0]?.count || 0),
      capabilities: { catalogRead: true, nativePush: false, wechatSubscriptionMessages: false, personalQuotaAccess: false }
    }, { headers });
  } catch {
    return Response.json({ message: "读取失败，事件状态未知；请稍后重试。", availability: "unavailable" }, { status: 503, headers });
  }
}
