import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const subscriberId = verifyUnsubscribeToken(token);

  if (!subscriberId) {
    return new NextResponse("Invalid or expired token", { status: 400 });
  }

  const client = db();
  if (!client) return new NextResponse("Database unavailable", { status: 503 });

  await client.query(
    "update subscribers set status='unsubscribed', updated_at=now() where id=$1",
    [subscriberId]
  );

  return NextResponse.redirect(new URL("/unsubscribe/success", request.url), 303);
}
