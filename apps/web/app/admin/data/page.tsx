import { query, queryOne } from "@/lib/db";

export default async function DataPage() {
  const [events, deliveries, health] = await Promise.all([
    query<any>(
      `select event_name, count(*)::int as count
         from events
        where created_at > now() - interval '30 days'
        group by event_name
        order by count desc
        limit 20`
    ),
    query<any>(
      `select channel, status, count(*)::int as count
         from deliveries
        where created_at > now() - interval '30 days'
        group by channel, status
        order by channel, status`
    ),
    queryOne<any>("select value, updated_at from app_settings where key='monitor_health'")
  ]);

  return (
    <>
      <div className="admin-heading">
        <div><span className="kicker">DATA</span><h1>数据与健康</h1></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <span className="kicker">Monitor</span>
          <h3>监控健康状态</h3>
          {health ? (
            <pre className="code-block">{JSON.stringify(health.value, null, 2)}</pre>
          ) : <p className="muted">尚未收到监控器健康入库数据。</p>}
        </div>

        <div className="card">
          <span className="kicker">Delivery</span>
          <h3>近 30 天发送结果</h3>
          <div className="stack compact">
            {deliveries.map((row, index) => (
              <div className="data-row" key={index}>
                <span>{row.channel} · {row.status}</span><strong>{row.count}</strong>
              </div>
            ))}
            {!deliveries.length ? <p className="muted">暂无发送记录。</p> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <span className="kicker">Growth</span>
        <h3>近 30 天事件</h3>
        <div className="stack compact">
          {events.map(row => (
            <div className="data-row" key={row.event_name}>
              <span>{row.event_name}</span><strong>{row.count}</strong>
            </div>
          ))}
          {!events.length ? <p className="muted">事件采集接口已预留，尚无数据。</p> : null}
        </div>
      </div>
    </>
  );
}
