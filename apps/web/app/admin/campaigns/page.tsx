import { getCampaigns } from "@/lib/admin-data";

export default async function CampaignsPage({
  searchParams
}: { searchParams: Promise<{ sent?: string; failed?: string }> }) {
  const [items, params] = await Promise.all([getCampaigns(), searchParams]);

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">Distribution</span><h1>分发活动</h1></div>
        <a className="button button-small" href="/admin/campaigns/new">新建活动</a>
      </div>

      {params.sent ? (
        <div className="notice success" style={{ marginBottom: 16 }}>
          本次发送：成功 {params.sent}，失败 {params.failed || "0"}。
        </div>
      ) : null}

      <div className="table-card">
        <table>
          <thead><tr><th>活动</th><th>受众</th><th>渠道</th><th>状态</th><th>计划时间</th><th>操作</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong></td>
                <td>{item.audience}</td>
                <td>{Array.isArray(item.channels) ? item.channels.join(" / ") : "-"}</td>
                <td><span className="tag">{item.status}</span></td>
                <td>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "-"}</td>
                <td>
                  <form action={"/api/admin/campaigns/" + item.id + "/send"} method="post">
                    <button className="inline-action" type="submit" disabled={item.status === "sent"}>
                      {item.status === "sent" ? "已发送" : "立即发送"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!items.length ? <tr><td colSpan={6} className="muted">还没有分发活动。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
