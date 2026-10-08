import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { qualifyReferral, rejectReferral } from "@/lib/referrals";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const form = await request.formData();
  const action = String(form.get("action") || "");

  try {
    if (action === "qualify") await qualifyReferral(id);
    else if (action === "reject") await rejectReferral(id);
    else return new NextResponse("Unsupported action", { status: 400 });

    return NextResponse.redirect(new URL("/admin/referrals", request.url), 303);
  } catch (error) {
    console.error("referral review failed", error);
    return NextResponse.redirect(new URL("/admin/referrals?error=1", request.url), 303);
  }
}
