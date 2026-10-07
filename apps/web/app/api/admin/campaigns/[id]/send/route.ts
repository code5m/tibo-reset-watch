import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sendCampaign } from "@/lib/campaign-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await context.params;
  try {
    const result = await sendCampaign(id);
    const url = new URL("/admin/campaigns", request.url);
    url.searchParams.set("sent", String(result.sent));
    url.searchParams.set("failed", String(result.failed));
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error(error);
    return new NextResponse("Campaign send failed", { status: 500 });
  }
}
