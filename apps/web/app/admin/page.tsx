import { getDashboardMetrics } from "@/lib/admin-data";
import { hasDatabase } from "@/lib/db";

export default async function AdminDashboard() {
  const metrics = await getDashboardMetrics();
  const cards = [
    ["订阅用户", metrics.subscribers],
    ["Reset 信号", metrics.signals],
    ["项目线索", metrics.projects],
    ["分发活动", metrics.campaigns],
    ["成功发送", metrics.deliveries]
  ];

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="kicker">运营总览</span>
          <h1>今天需要关注什么</h1>
        </div>
        <div className={"tag " + (hasDatabase() ? "success" : "")}>
          {hasDatabase() ? "DATABASE CONNECTED" : "DATABASE NOT CONFIGURED"}
        </div>
      </div>

      <div className="admin-metrics">
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="muted">{label}</div>
            <div className="metric">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <span className="kicker">当前产品策略</span>
          <h3>Reset 即时，项目聚合</h3>
          <p className="muted">Reset 是最高优先级；项目线索默认每日聚合，避免噪音和通知额度浪费。</p>
        </div>
        <div className="card">
          <span className="kicker">下一步增长</span>
          <h3>把每个访客变成可持续关系</h3>
          <p className="muted">首页 → 订阅 → Reset 价值兑现 → 指南/项目内容 → 口碑传播，是首期核心漏斗。</p>
        </div>
      </div>
    </>
  );
}
