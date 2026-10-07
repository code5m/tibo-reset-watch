import { getSignals } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Codex / ChatGPT Work Reset 时间线",
  description: "查看已核验的 Codex / ChatGPT Work Reset、Banked Reset 与未来重置时间，并统一转换为北京时间。"
};

function cn(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false
  });
}

export default async function ResetPage() {
  const signals = await getSignals();

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">RESET INTELLIGENCE</span>
          <h1>Reset 时间线</h1>
          <p>
            已完成、未来计划、Banked Reset 分开呈现。每条记录保留原始来源，
            时间统一按北京时间显示。
          </p>
        </div>
      </section>
      <section className="content-shell">
        <div className="shell stack">
          {signals.map(item => (
            <article className="card timeline-card" key={item.id}>
              <div className="timeline-meta">
                <span className={"tag signal-" + item.kind}>{item.kind}</span>
                <span>{cn(item.sourceCreatedAt)}</span>
              </div>
              <h2>{item.title}</h2>
              <p className="muted">{item.body}</p>
              {item.resetAt ? <p><strong>预计 Reset（北京时间）：</strong>{cn(item.resetAt)}</p> : null}
              <a className="text-link" href={item.sourceUrl} target="_blank" rel="noreferrer">查看 Tibo 原帖 →</a>
            </article>
          ))}
          {!signals.length ? (
            <div className="card empty-state">
              <span className="kicker">等待第一条数据库记录</span>
              <h2>监控器已经运行，网站数据库尚未同步信号。</h2>
              <p className="muted">配置 DATABASE_URL 后，监控器会把新的 Reset 信号同步进这里。</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
