export default async function NewCampaignPage({
  searchParams
}: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">DISTRIBUTION</span><h1>新建分发活动</h1></div>
        <a className="text-link" href="/admin/campaigns">← 返回活动列表</a>
      </div>
      <div className="card">
        <form className="form" action="/api/admin/campaigns" method="post">
          <div className="field"><label>活动标题</label><input name="title" required /></div>
          <div className="field"><label>正文</label><textarea name="body" rows={12} required /></div>
          <div className="field">
            <label>受众</label>
            <select name="audience" defaultValue="all">
              <option value="all">全部活跃用户</option>
              <option value="reset">只关注 Reset</option>
              <option value="projects">只关注项目</option>
              <option value="guides">只关注指南</option>
            </select>
          </div>
          <fieldset className="choice-group">
            <legend>渠道</legend>
            <label><input type="checkbox" name="channels" value="email" defaultChecked /> 邮件</label>
            <label><input type="checkbox" name="channels" value="wechat" /> 微信</label>
            <label><input type="checkbox" name="channels" value="sms" /> 短信</label>
            <label><input type="checkbox" name="channels" value="alipay" /> 支付宝</label>
          </fieldset>
          <div className="field"><label>计划时间（可选，ISO 时间）</label><input name="scheduledAt" placeholder="2026-10-09T10:00:00+08:00" /></div>
          {params.error ? <div className="notice error">保存失败：{params.error}</div> : null}
          <button className="button" type="submit">保存活动</button>
        </form>
      </div>
    </>
  );
}
