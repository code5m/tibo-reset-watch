import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qualifyReferral } from "@/lib/referrals";

function authorized(request: Request) {
  const expected = process.env.REFERRAL_SECRET || process.env.INGEST_SECRET;
  return Boolean(expected && request.headers.get("authorization") === "Bearer " + expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const client = db();
  if (!client) return new NextResponse("Database unavailable", { status: 503 });

  const payload = await request.json();
  let referralId = String(payload?.referralId || "");

  if (!referralId && payload?.subscriberId) {
    const result = await client.query(
      "select id from referrals where invitee_id=$1 and status='pending' limit 1",
      [String(payload.subscriberId)]
    );
    referralId = String(result.rows[0]?.id || "");
  }

  if (!referralId) return new NextResponse("Referral not found", { status: 404 });

  try {
    const result = await qualifyReferral(referralId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
