import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const client = db();
  if (!client) return new NextResponse("Database unavailable", { status: 503 });

  const { id } = await context.params;
  const form = await request.formData();
  const requested = String(form.get("status") || "");
  const status = ["active", "pending", "unsubscribed"].includes(requested)
    ? requested
    : "unsubscribed";

  await client.query(
    "update subscribers set status=$1, updated_at=now() where id=$2",
    [status, id]
  );

  return NextResponse.redirect(new URL("/admin/subscribers", request.url), 303);
}
