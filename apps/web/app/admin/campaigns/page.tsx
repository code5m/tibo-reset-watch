import { getCampaigns } from "@/lib/admin-data";

export default async function CampaignsPage() {
  const items = await getCampaigns();

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">Distribution</span><h1>分发活动</h1></div>
        <a className="button button-small" href="/admin/campaigns/new">新建活动</a>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>活动</th><th>受众</th><th>渠道</th><th>状态</th><th>计划时间</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong></td>
                <td>{item.audience}</td>
                <td>{Array.isArray(item.channels) ? item.channels.join(" / ") : "-"}</td>
                <td><span className="tag">{item.status}</span></td>
                <td>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "-"}</td>
              </tr>
            ))}
            {!items.length ? <tr><td colSpan={5} className="muted">还没有分发活动。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
