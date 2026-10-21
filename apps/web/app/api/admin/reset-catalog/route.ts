import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { validateCatalog } from "@/public/workbench/reset-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const KEY = "resetwatch.catalog.v1";
const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

export async function GET() {
  if (!(await isAdmin())) return json({ message: "请先登录管理员。" }, 401);
  const pool = db();
  if (!pool) return json({ message: "数据库未配置。" }, 503);
  try {
    const [saved, pending] = await Promise.all([
      pool.query("select value from app_settings where key=$1", [KEY]),
      pool.query("select source_post_id, kind, body, source_url, source_created_at from signals order by source_created_at desc limit 100")
    ]);
    return json({
      version: saved.rows[0]?.value?.version || 0,
      catalog: saved.rows[0]?.value?.catalog || { schemaVersion: 1, events: [] },
      pendingSignals: pending.rows,
      pendingLimit: 100
    });
  } catch { return json({ message: "读取失败。" }, 503); }
}

/** Stream the request with a hard byte cap; Content-Length alone is not trustworthy. */
async function readBounded(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("请求体为空");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) { await reader.cancel(); throw new Error("目录超过 256KB 限制"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { merged.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(merged));
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return json({ message: "请先登录管理员。" }, 401);
  // Session cookies alone are insufficient: reject cross-origin writes before reading the body.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ message: "拒绝跨站写入。" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ message: "仅接受 JSON。" }, 415);
  const pool = db();
  if (!pool) return json({ message: "数据库未配置。" }, 503);
  let payload: { expectedVersion: number; catalog: ReturnType<typeof validateCatalog> };
  try {
    const body = await readBounded(request);
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) throw new Error("版本号不正确");
    payload = { expectedVersion: body.expectedVersion, catalog: validateCatalog(body.catalog) };
  } catch (error) { return json({ message: error instanceof Error ? error.message : "目录格式错误" }, 400); }
  let client;
  try { client = await pool.connect(); }
  catch { return json({ message: "数据库连接失败。" }, 503); }
  try {
    await client.query("begin");
    // Inserting before locking also serializes first-time concurrent writers.
    await client.query("insert into app_settings(key,value) values($1,$2::jsonb) on conflict(key) do nothing",
      [KEY, JSON.stringify({ version: 0, catalog: { schemaVersion: 1, events: [] } })]);
    const saved = await client.query("select value from app_settings where key=$1 for update", [KEY]);
    const oldVersion = saved.rows[0].value.version;
    if (oldVersion !== payload.expectedVersion) {
      await client.query("rollback");
      return json({ message: "目录已被其他操作更新，请重新读取后合并修改。", version: oldVersion }, 409);
    }
    const version = oldVersion + 1;
    await client.query("update app_settings set value=$2::jsonb,updated_at=now() where key=$1",
      [KEY, JSON.stringify({ version, catalog: payload.catalog })]);
    await client.query("insert into events(event_name,metadata) values($1,$2::jsonb)",
      ["reset_catalog_updated", JSON.stringify({ version, eventCount: payload.catalog.events.length })]);
    await client.query("commit");
    // Editing evidence must not implicitly create or send a campaign.
    return json({ ok: true, version, notificationsSent: false });
  } catch {
    try { await client.query("rollback"); } catch { /* Connection loss: never claim success. */ }
    return json({ message: "保存失败；未确认成功，请重新读取目录。" }, 503);
  } finally { client.release(); }
}
