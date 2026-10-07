import Link from "next/link";

export const metadata = {
  title: "订阅方案",
  description: "ResetWatch 早期用户订阅方案。首期免费体验 Reset 情报与 AI 项目精选。"
};

const plans = [
  {
    name: "Free",
    price: "¥0",
    note: "早期用户",
    features: ["Reset 时间线", "基础邮件提醒", "北京时间换算", "项目雷达公开页"],
    cta: "免费加入"
  },
  {
    name: "Pro",
    price: "即将推出",
    note: "个人高频用户",
    features: ["微信 / 短信多通道", "临近 Reset 二次提醒", "项目精选日报", "更多 AI 服务额度情报"],
    cta: "加入候补"
  },
  {
    name: "Team",
    price: "即将推出",
    note: "团队与工作室",
    features: ["团队订阅者管理", "自定义分发策略", "Webhook / API", "运营数据与发送审计"],
    cta: "联系内测"
  }
];

export default function PricingPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">PRICING</span>
          <h1>先证明价值，再收费。</h1>
          <p>这是第一次创业，所以首期不急着把每个功能都收费。先把“提醒真的有用”做成口碑。</p>
        </div>
      </section>
      <section className="content-shell">
        <div className="shell grid-3">
          {plans.map(plan => (
            <article className="card pricing-card" key={plan.name}>
              <span className="tag">{plan.note}</span>
              <h2>{plan.name}</h2>
              <div className="price">{plan.price}</div>
              <ul>{plan.features.map(item => <li key={item}>{item}</li>)}</ul>
              <Link className="button" href="/subscribe">{plan.cta}</Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
