import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "系统状态",
  description: "ResetWatch 数据源、监控器和通知系统状态。"
};

export default async function StatusPage() {
  const health = await queryOne<any>(
    "select value, updated_at from app_settings where key='monitor_health'"
  );

  const value = health?.value || {};
  const healthy = Number(value?.consecutiveFailures || 0) === 0;

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">STATUS</span>
          <h1>系统状态</h1>
          <p>我们宁愿公开“数据源现在有问题”，也不把旧数据伪装成最新结果。</p>
        </div>
      </section>
      <section className="content-shell">
        <div className="shell grid-2">
          <div className="card">
            <span className={"status-badge " + (healthy ? "healthy" : "degraded")}>
              {health ? (healthy ? "Operational" : "Degraded") : "Awaiting data"}
            </span>
            <h2>监控器</h2>
            <p className="muted">最近数据源：{value?.lastSource || "-"}</p>
            <p className="muted">连续失败：{value?.consecutiveFailures ?? "-"}</p>
            <p className="muted">最后成功：{value?.lastSuccessAt ? new Date(value.lastSuccessAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "-"}</p>
          </div>
          <div className="card">
            <span className="kicker">TRANSPARENCY</span>
            <h2>状态页只显示已知事实</h2>
            <p className="muted">数据库尚未收到健康数据时显示 Awaiting data，而不是默认显示绿色。</p>
          </div>
        </div>
      </section>
    </>
  );
}
