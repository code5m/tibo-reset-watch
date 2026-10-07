import { getContentItems } from "@/lib/admin-data";

export default async function ContentPage() {
  const items = await getContentItems();

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">内容资产</span><h1>内容工作台</h1></div>
        <a className="button button-small" href="/admin/content/new">新建内容</a>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>标题</th><th>类型</th><th>状态</th><th>Slug</th><th>发布时间</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong><br/><span className="muted">{item.excerpt}</span></td>
                <td>{item.content_type}</td>
                <td><span className="tag">{item.status}</span></td>
                <td>{item.slug}</td>
                <td>{item.published_at ? new Date(item.published_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "-"}</td>
              </tr>
            ))}
            {!items.length ? <tr><td colSpan={5} className="muted">还没有内容。先创建第一篇 Reset 指南。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
