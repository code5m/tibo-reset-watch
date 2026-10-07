import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { submitIndexNow } from "@/lib/indexnow";

function clean(value: FormDataEntryValue | null, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const client = db();
  if (!client) return new NextResponse("Database unavailable", { status: 503 });

  const { id } = await context.params;
  const form = await request.formData();
  const title = clean(form.get("title"), 200);
  const slug = clean(form.get("slug"), 160).toLowerCase().replace(/[^a-z0-9\-_]+/g, "-").replace(/^-|-$/g, "");
  const excerpt = clean(form.get("excerpt"), 500);
  const body = clean(form.get("body"), 50000);
  const contentType = clean(form.get("contentType"), 30) || "article";
  const status = clean(form.get("status"), 20) === "published" ? "published" : "draft";
  const seoTitle = clean(form.get("seoTitle"), 200);
  const seoDescription = clean(form.get("seoDescription"), 500);
  const geoSummary = clean(form.get("geoSummary"), 1200);

  if (!title || !slug || !body) return new NextResponse("Missing required fields", { status: 400 });

  await client.query(
    `update content_items
        set title=$1, slug=$2, excerpt=$3, body=$4, content_type=$5, status=$6,
            seo_title=$7, seo_description=$8, geo_summary=$9,
            published_at=case
              when $6='published' and published_at is null then now()
              when $6='draft' then null
              else published_at
            end,
            updated_at=now()
      where id=$10`,
    [title, slug, excerpt, body, contentType, status, seoTitle || null, seoDescription || null, geoSummary || null, id]
  );

  if (status === "published") {
    await submitIndexNow(["/insights/" + slug, "/sitemap.xml", "/feed.xml"]);
  }

  return NextResponse.redirect(new URL("/admin/content", request.url), 303);
}
