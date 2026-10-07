import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { site } from "@/lib/site";

async function getContent(slug: string) {
  return queryOne<any>(
    `select title, slug, excerpt, body, content_type, seo_title, seo_description,
            geo_summary, published_at, updated_at
       from content_items
      where slug=$1 and status='published'
      limit 1`,
    [slug]
  );
}

export async function generateMetadata({
  params
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getContent(slug);
  if (!item) return {};

  return {
    title: item.seo_title || item.title,
    description: item.seo_description || item.excerpt,
    alternates: { canonical: "/insights/" + item.slug },
    openGraph: {
      type: "article",
      title: item.seo_title || item.title,
      description: item.seo_description || item.excerpt,
      url: site.url + "/insights/" + item.slug,
      publishedTime: item.published_at || undefined,
      modifiedTime: item.updated_at || undefined
    }
  };
}

export default async function InsightPage({
  params
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getContent(slug);
  if (!item) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: item.title,
    description: item.excerpt,
    datePublished: item.published_at,
    dateModified: item.updated_at,
    mainEntityOfPage: site.url + "/insights/" + item.slug,
    publisher: { "@type": "Organization", name: site.name, url: site.url }
  };

  return (
    <article className="article-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <div className="shell article">
        <span className="kicker">{String(item.content_type).toUpperCase()}</span>
        <h1>{item.title}</h1>
        <p className="lead">{item.excerpt}</p>
        {item.geo_summary ? (
          <div className="answer-box">
            <strong>快速答案</strong>
            <p>{item.geo_summary}</p>
          </div>
        ) : null}
        <div className="article-body">
          {String(item.body).split("\n\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
