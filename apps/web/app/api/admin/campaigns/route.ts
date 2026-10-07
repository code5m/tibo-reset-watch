import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

function clean(value: FormDataEntryValue | null, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const client = db();
  if (!client) return NextResponse.redirect(new URL("/admin/campaigns/new?error=database", request.url), 303);

  const form = await request.formData();
  const title = clean(form.get("title"), 200);
  const body = clean(form.get("body"), 20000);
  const audience = clean(form.get("audience"), 80) || "all";
  const channels = form.getAll("channels").map(v => clean(v, 20)).filter(Boolean);
  const scheduledAt = clean(form.get("scheduledAt"), 80);

  if (!title || !body || !channels.length) {
    return NextResponse.redirect(new URL("/admin/campaigns/new?error=required", request.url), 303);
  }

  await client.query(
    `insert into campaigns(title, body, audience, channels, status, scheduled_at)
     values($1,$2,$3,$4::jsonb,$5,$6)`,
    [title, body, audience, JSON.stringify(channels), scheduledAt ? "scheduled" : "draft", scheduledAt || null]
  );

  return NextResponse.redirect(new URL("/admin/campaigns", request.url), 303);
}
