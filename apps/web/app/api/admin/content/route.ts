import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

function clean(value: FormDataEntryValue | null, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const client = db();
  if (!client) return NextResponse.redirect(new URL("/admin/content/new?error=database", request.url), 303);

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

  if (!title || !slug || !body) {
    return NextResponse.redirect(new URL("/admin/content/new?error=required", request.url), 303);
  }

  try {
    await client.query(
      `insert into content_items(title, slug, excerpt, body, content_type, status, seo_title, seo_description, geo_summary, published_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,case when $6='published' then now() else null end)`,
      [title, slug, excerpt, body, contentType, status, seoTitle || null, seoDescription || null, geoSummary || null]
    );
    return NextResponse.redirect(new URL("/admin/content", request.url), 303);
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/admin/content/new?error=save", request.url), 303);
  }
}
