import Link from "next/link";

const guides = [
  {
    href: "/guides/codex-reset",
    title: "Codex Reset 是什么？怎么判断“已经重置”",
    description: "理解 completed、scheduled、hint 的区别，避免把“soon”误当成已经恢复额度。"
  },
  {
    href: "/guides/banked-reset",
    title: "Banked Reset 是什么？为什么不能和普通 Reset 混在一起",
    description: "解释储备 Reset 的含义，以及为什么提醒系统必须单独分类。"
  },
  {
    href: "/guides/timezone",
    title: "Tibo 说的 PT / PST / PDT，怎么换成北京时间",
    description: "一页搞懂美国太平洋时区、夏令时和 UTC+8 的换算风险。"
  }
];

export const metadata = {
  title: "Codex / ChatGPT Work Reset 使用指南",
  description: "Reset、Banked Reset、PT/PST/PDT 北京时间换算与额度使用策略指南。"
};

export default function GuidesPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">GUIDES</span>
          <h1>把“知道消息”变成“理解规则”。</h1>
          <p>这些内容围绕真实用户问题写，不为了堆 SEO 关键词；每篇先回答问题，再解释判断依据。</p>
        </div>
      </section>
      <section className="content-shell">
        <div className="shell grid-3">
          {guides.map(item => (
            <Link className="card guide-card" href={item.href} key={item.href}>
              <span className="kicker">GUIDE</span>
              <h2>{item.title}</h2>
              <p className="muted">{item.description}</p>
              <span className="text-link">阅读指南 →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
