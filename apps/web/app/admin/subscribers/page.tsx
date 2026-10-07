import { getSubscribers } from "@/lib/admin-data";

export default async function SubscribersPage() {
  const rows = await getSubscribers();

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">CRM</span><h1>订阅用户</h1></div>
        <span className="tag">{rows.length} 条最近记录</span>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>用户</th><th>渠道</th><th>兴趣</th><th>来源</th><th>状态</th><th>加入时间</th></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td><strong>{row.name || row.email || row.phone || row.wechat_target}</strong><br/><span className="muted">{row.email || row.phone || "-"}</span></td>
                <td>{Array.isArray(row.channels) ? row.channels.join(" / ") : "-"}</td>
                <td>{Array.isArray(row.interests) ? row.interests.join(" / ") : "-"}</td>
                <td>{row.source}</td>
                <td><span className="tag">{row.status}</span></td>
                <td>{new Date(row.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="muted">还没有订阅用户。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
