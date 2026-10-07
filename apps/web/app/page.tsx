import Link from "next/link";

const benefits = [
  {
    eyebrow: "01 · Reset 情报",
    title: "不是关键词提醒，而是“能不能行动”的判断",
    body: "区分 completed、scheduled、banked 和模糊 hint。Tibo 真正说“reset has been processed”时才把它当成高优先级提醒。"
  },
  {
    eyebrow: "02 · 中国时间",
    title: "PT / UTC 自动换成北京时间",
    body: "不用再心算 PST、PDT 和夏令时。能够可靠换算的时间统一显示 Asia/Shanghai；不确定就明确告诉你不确定。"
  },
  {
    eyebrow: "03 · 使用决策",
    title: "临近 Reset，再提醒你一次",
    body: "明确未来 Reset 时，会在临近窗口再次提醒你先查看真实剩余额度，再把额度优先用在代码、测试、调研和文档等真实任务上。"
  }
];

const proof = [
  ["5 分钟", "监控调度粒度"],
  ["UTC+8", "统一北京时间"],
  ["双通道", "微信冗余通知"],
  ["可追溯", "每条提醒带原始来源"]
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <div className="eyebrow-pill">
              <span className="pulse-dot" />
              Tibo @thsottiaux Reset Intelligence
            </div>
            <h1>
              别再错过
              <span className="text-gradient">下一次额度重置</span>
            </h1>
            <p className="hero-copy">
              ResetWatch 监控 Tibo 的公开动态，把 Codex / ChatGPT Work 的 Reset、
              Banked Reset 和明确未来时间转换成北京时间，并通过你选择的渠道提醒。
            </p>
            <div className="hero-actions">
              <Link className="button" href="/subscribe">免费订阅提醒</Link>
              <Link className="button button-ghost" href="/reset">查看 Reset 时间线</Link>
            </div>
            <p className="microcopy">
              首期免费 · 不需要登录 X · 不是 OpenAI 官方产品
            </p>
          </div>

          <div className="signal-card">
            <div className="signal-topline">
              <span>RESET SIGNAL</span>
              <span className="status-live">LIVE</span>
            </div>
            <div className="signal-main">
              <span className="signal-icon">↻</span>
              <div>
                <strong>已完成 Reset</strong>
                <p>“the reset has been processed. Enjoy!”</p>
              </div>
            </div>
            <div className="signal-row">
              <span>北京时间</span>
              <strong>自动换算 UTC+8</strong>
            </div>
            <div className="signal-row">
              <span>通知策略</span>
              <strong>新信号才发送</strong>
            </div>
            <div className="signal-row">
              <span>原始证据</span>
              <strong>保留 X permalink</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="shell proof-grid">
          {proof.map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading">
            <span className="kicker">为什么做这个产品</span>
            <h2>把“我看到一条推文”变成“我知道下一步该做什么”</h2>
            <p>
              真正有价值的不是更多通知，而是更少、更可靠、更接近行动时点的通知。
            </p>
          </div>
          <div className="feature-grid">
            {benefits.map(item => (
              <article className="feature-card" key={item.title}>
                <span>{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="shell split">
          <div>
            <span className="kicker">不仅是 Reset</span>
            <h2>Tibo 分享的好项目，也帮你从噪音里筛出来</h2>
            <p className="section-copy">
              GitHub、Open Source、Agent、MCP、SDK、API、Framework、Tool 等高信号内容进入“项目雷达”，
              默认做成每日聚合，不和最重要的 Reset 抢通知额度。
            </p>
            <Link className="text-link" href="/projects">打开项目雷达 →</Link>
          </div>
          <div className="radar-list">
            <div><span>GitHub</span><strong>代码与仓库</strong></div>
            <div><span>Agent / MCP</span><strong>AI 工具链</strong></div>
            <div><span>SDK / API</span><strong>开发能力</strong></div>
            <div><span>Framework</span><strong>值得试的新框架</strong></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell cta-panel">
          <div>
            <span className="kicker">早期用户计划</span>
            <h2>先把最重要的一件事做好：不漏掉值得行动的 Reset。</h2>
            <p>留下你的通知方式。后续会逐步开放更多 AI 产品额度情报与团队版工作台。</p>
          </div>
          <Link className="button" href="/subscribe">加入首批订阅用户</Link>
        </div>
      </section>
    </>
  );
}
