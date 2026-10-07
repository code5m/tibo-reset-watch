import { site } from "@/lib/site";

const faqs = [
  {
    q: "Codex / ChatGPT Work 的 Reset 是什么？",
    a: "Reset 指使用额度或限额窗口被重新恢复。ResetWatch 会把 Tibo 的公开说明区分为已完成、未来计划、Banked Reset 和模糊线索，并保留原始来源。"
  },
  {
    q: "ResetWatch 是 OpenAI 官方产品吗？",
    a: "不是。ResetWatch 是独立的第三方信息与提醒服务，不代表 OpenAI，也不保证任何公开帖文一定适用于你的具体账户。"
  },
  {
    q: "为什么要换算成北京时间？",
    a: "Tibo 的公开信息可能使用 UTC、PT、PST 或 PDT。ResetWatch 在时区信息足够明确时统一转换为 Asia/Shanghai（UTC+8），避免手动换算错误。"
  },
  {
    q: "什么是 Banked Reset？",
    a: "Banked Reset 与普通已完成 Reset 不完全相同。ResetWatch 会单独标记它，避免把“储备的 Reset”错误理解成“现在所有额度都已经立即刷新”。"
  },
  {
    q: "我能保证每次都第一时间收到吗？",
    a: "不能做绝对保证。GitHub 调度、X 数据源、网络与通知服务都可能产生延迟。项目通过 5 分钟轮询、数据源新鲜度校验、失败告警和多通道通知来尽量降低漏报风险。"
  },
  {
    q: "我应该为了 Reset 把额度全部用完吗？",
    a: "不建议为了清零做无意义消耗。更合理的做法是临近 Reset 时先检查账户真实剩余额度，再把额度优先用于代码实现、测试、审查、调研和文档等真实任务。"
  }
];

export const metadata = {
  title: "FAQ｜Codex Reset、Banked Reset 与北京时间提醒",
  description: "回答 Codex / ChatGPT Work Reset、Banked Reset、时区换算和提醒可靠性等常见问题。"
};

export default function FAQPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(item => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }))
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">FAQ</span>
          <h1>先把最关键的问题说清楚。</h1>
          <p>这也是给搜索引擎和 AI 回答系统准备的“明确答案层”：结论优先、来源可核验、不夸大。</p>
        </div>
      </section>
      <section className="content-shell">
        <div className="shell stack">
          {faqs.map(item => (
            <article className="card faq-card" key={item.q}>
              <h2>{item.q}</h2>
              <p>{item.a}</p>
            </article>
          ))}
          <div className="notice">
            产品主页：{site.url} · Tibo 原始公开账号：@thsottiaux
          </div>
        </div>
      </section>
    </>
  );
}
