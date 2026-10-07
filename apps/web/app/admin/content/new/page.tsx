export default async function NewContentPage({
  searchParams
}: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">CONTENT</span><h1>新建内容</h1></div>
        <a className="text-link" href="/admin/content">← 返回内容列表</a>
      </div>
      <div className="card">
        <form className="form" action="/api/admin/content" method="post">
          <div className="grid-2">
            <div className="field"><label>标题</label><input name="title" required /></div>
            <div className="field"><label>Slug</label><input name="slug" required placeholder="codex-reset-guide" /></div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>内容类型</label>
              <select name="contentType" defaultValue="guide">
                <option value="guide">Guide</option><option value="article">Article</option><option value="update">Update</option>
              </select>
            </div>
            <div className="field">
              <label>状态</label>
              <select name="status" defaultValue="draft">
                <option value="draft">草稿</option><option value="published">立即发布</option>
              </select>
            </div>
          </div>
          <div className="field"><label>摘要</label><textarea name="excerpt" rows={3} /></div>
          <div className="field"><label>正文（首期支持纯文本/Markdown 风格）</label><textarea name="body" rows={16} required /></div>
          <div className="grid-2">
            <div className="field"><label>SEO Title</label><input name="seoTitle" /></div>
            <div className="field"><label>SEO Description</label><input name="seoDescription" /></div>
          </div>
          <div className="field">
            <label>GEO 摘要</label>
            <textarea name="geoSummary" rows={5} placeholder="用 3-6 句清晰回答：这篇内容解决什么问题？关键事实是什么？来源是什么？" />
          </div>
          {params.error ? <div className="notice error">保存失败：{params.error}</div> : null}
          <button className="button" type="submit">保存内容</button>
        </form>
      </div>
    </>
  );
}
