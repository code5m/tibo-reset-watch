import { getReferralMetrics, getReferrals } from "@/lib/admin-data";
import { referralMonthlyCap, referralRewardCredits } from "@/lib/referrals";

function identity(row: any, prefix: "inviter" | "invitee") {
  return row[prefix + "_name"] || row[prefix + "_email"] || row[prefix + "_phone"] || row[prefix + "_id"];
}

export default async function AdminReferralsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const [metrics, rows] = await Promise.all([getReferralMetrics(), getReferrals()]);
  const reward = referralRewardCredits();
  const cap = referralMonthlyCap();

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="kicker">REFERRAL / REWARD</span>
          <h1>邀请与短信奖励</h1>
        </div>
        <span className="tag">每有效邀请 +{reward} · 月上限 {cap}</span>
      </div>

      {params.error ? <div className="notice error" style={{ marginBottom: 16 }}>操作失败，请检查订阅状态或数据库。</div> : null}

      <div className="admin-metrics">
        <div className="card"><div className="muted">待确认</div><div className="metric">{metrics.pending}</div></div>
        <div className="card"><div className="muted">有效邀请</div><div className="metric">{metrics.qualified}</div></div>
        <div className="card"><div className="muted">已拒绝</div><div className="metric">{metrics.rejected}</div></div>
        <div className="card"><div className="muted">累计发放短信额度</div><div className="metric">{metrics.credits}</div></div>
      </div>

      <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <span className="kicker">ANTI-ABUSE</span>
        <h3>只奖励有效新增，不奖励分享动作</h3>
        <p className="muted">
          待确认邀请应由邮箱验证、短信 OTP、微信/支付宝真实绑定事件自动确认；早期也可以在这里人工审核。
          自邀、重复账号、批量虚假联系方式直接拒绝。
        </p>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr><th>邀请人</th><th>新用户</th><th>邀请码</th><th>来源</th><th>状态</th><th>时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td><strong>{identity(row, "inviter")}</strong><br/><span className="muted">短信余额 {row.inviter_sms_credits}</span></td>
                <td><strong>{identity(row, "invitee")}</strong><br/><span className="muted">{row.invitee_status}</span></td>
                <td>{row.referral_code}</td>
                <td>{row.source}</td>
                <td><span className="tag">{row.status}</span></td>
                <td>{new Date(row.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</td>
                <td>
                  {row.status === "pending" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <form action={"/api/admin/referrals/" + row.id + "/status"} method="post">
                        <input type="hidden" name="action" value="qualify" />
                        <button className="inline-action" type="submit">确认有效</button>
                      </form>
                      <form action={"/api/admin/referrals/" + row.id + "/status"} method="post">
                        <input type="hidden" name="action" value="reject" />
                        <button className="inline-action" type="submit">拒绝</button>
                      </form>
                    </div>
                  ) : "-"}
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="muted">还没有邀请记录。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
