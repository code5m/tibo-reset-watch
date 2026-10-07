import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const client = db();
  if (!client) return NextResponse.json({ ok: false }, { status: 202 });

  try {
    const payload = await request.json();
    const eventName = String(payload?.eventName || "").trim().slice(0, 80);
    if (!eventName) return new NextResponse("Invalid event", { status: 400 });

    await client.query(
      `insert into events(event_name, anonymous_id, path, referrer, metadata)
       values($1,$2,$3,$4,$5::jsonb)`,
      [
        eventName,
        String(payload?.anonymousId || "").slice(0, 120) || null,
        String(payload?.path || "").slice(0, 500) || null,
        String(payload?.referrer || "").slice(0, 1000) || null,
        JSON.stringify(payload?.metadata || {})
      ]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
