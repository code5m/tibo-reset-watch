import { NextResponse } from "next/server";
import { sendDueCampaigns } from "@/lib/campaign-service";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && request.headers.get("authorization") === "Bearer " + expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const results = await sendDueCampaigns(10);
  return NextResponse.json({ ok: true, results });
}
