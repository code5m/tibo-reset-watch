import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function authorized(request: Request) {
  const expected = process.env.INGEST_SECRET;
  const supplied = request.headers.get("authorization");
  return Boolean(expected && supplied === "Bearer " + expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const client = db();
  if (!client) return new NextResponse("Database unavailable", { status: 503 });

  const payload = await request.json();

  if (payload?.type === "signal") {
    await client.query(
      `insert into signals(source, source_post_id, kind, title, body, source_url, source_created_at, reset_at, metadata)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       on conflict(source, source_post_id, kind)
       do update set title=excluded.title, body=excluded.body, reset_at=excluded.reset_at, metadata=excluded.metadata`,
      [
        payload.source || "tibo-x",
        payload.sourcePostId,
        payload.kind,
        payload.title,
        payload.body,
        payload.sourceUrl,
        payload.sourceCreatedAt,
        payload.resetAt || null,
        JSON.stringify(payload.metadata || {})
      ]
    );

    if (["completed", "scheduled", "banked"].includes(payload.kind)) {
      const dedupeKey = "signal:" + payload.sourcePostId + ":" + payload.kind;
      const campaignBody = [
        payload.title,
        "",
        payload.body,
        "",
        payload.resetAt ? "预计 Reset：" + payload.resetAt : "",
        "原始来源：" + payload.sourceUrl,
        "",
        "ResetWatch 提醒：请结合你账户自己的 Usage / status 判断实际剩余额度。"
      ].filter(Boolean).join("\n");

      await client.query(
        `insert into campaigns(title, body, audience, channels, status, scheduled_at, dedupe_key)
         values($1,$2,'reset','["email","wechat","sms","alipay"]'::jsonb,'scheduled',now(),$3)
         on conflict(dedupe_key) where dedupe_key is not null do nothing`,
        [payload.title, campaignBody, dedupeKey]
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (payload?.type === "project") {
    await client.query(
      `insert into project_leads(source, source_post_id, title, summary, source_url, score, tags, source_created_at, metadata)
       values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb)
       on conflict(source_post_id)
       do update set title=excluded.title, summary=excluded.summary, score=excluded.score, tags=excluded.tags, metadata=excluded.metadata`,
      [
        payload.source || "tibo-x",
        payload.sourcePostId,
        payload.title,
        payload.summary,
        payload.sourceUrl,
        Number(payload.score || 0),
        JSON.stringify(payload.tags || []),
        payload.sourceCreatedAt,
        JSON.stringify(payload.metadata || {})
      ]
    );
    return NextResponse.json({ ok: true });
  }

  if (payload?.type === "health") {
    await client.query(
      `insert into app_settings(key, value, updated_at)
       values('monitor_health',$1::jsonb,now())
       on conflict(key) do update set value=excluded.value, updated_at=now()`,
      [JSON.stringify(payload.value || {})]
    );
    return NextResponse.json({ ok: true });
  }

  return new NextResponse("Unsupported payload", { status: 400 });
}
