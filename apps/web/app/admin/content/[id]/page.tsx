import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";

export default async function EditContentPage({
  params
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await queryOne<any>(
    `select id, title, slug, excerpt, body, content_type, status,
            seo_title, seo_description, geo_summary
       from content_items where id=$1 limit 1`,
    [id]
  );

  if (!item) notFound();

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">CONTENT</span><h1>编辑内容</h1></div>
        <a className="text-link" href="/admin/content">← 返回内容列表</a>
      </div>
      <div className="card">
        <form className="form" action={"/api/admin/content/" + id} method="post">
          <div className="grid-2">
            <div className="field"><label>标题</label><input name="title" defaultValue={item.title} required /></div>
            <div className="field"><label>Slug</label><input name="slug" defaultValue={item.slug} required /></div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>内容类型</label>
              <select name="contentType" defaultValue={item.content_type}>
                <option value="guide">Guide</option><option value="article">Article</option><option value="update">Update</option>
              </select>
            </div>
            <div className="field">
              <label>状态</label>
              <select name="status" defaultValue={item.status}>
                <option value="draft">草稿</option><option value="published">发布</option>
              </select>
            </div>
          </div>
          <div className="field"><label>摘要</label><textarea name="excerpt" rows={3} defaultValue={item.excerpt} /></div>
          <div className="field"><label>正文</label><textarea name="body" rows={16} defaultValue={item.body} required /></div>
          <div className="grid-2">
            <div className="field"><label>SEO Title</label><input name="seoTitle" defaultValue={item.seo_title || ""} /></div>
            <div className="field"><label>SEO Description</label><input name="seoDescription" defaultValue={item.seo_description || ""} /></div>
          </div>
          <div className="field"><label>GEO 摘要</label><textarea name="geoSummary" rows={5} defaultValue={item.geo_summary || ""} /></div>
          <button className="button" type="submit">保存更新</button>
        </form>
      </div>
    </>
  );
}
