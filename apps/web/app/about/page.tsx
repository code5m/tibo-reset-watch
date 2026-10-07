export const metadata = {
  title: "关于 ResetWatch",
  description: "ResetWatch 的产品使命、信息来源原则与创业方向。"
};

export default function AboutPage() {
  return (
    <section className="page-hero">
      <div className="shell article">
        <span className="kicker">ABOUT</span>
        <h1>第一次创业，先解决一个自己真的遇到的问题。</h1>
        <p className="lead">
          ResetWatch 起点很简单：Tibo 偶尔会公开宣布 Codex / ChatGPT Work Reset，
          但时区、通知、上下文和“到底算不算已经完成”都需要人工判断。
        </p>
        <h2>我们想做什么</h2>
        <p>把零散的 AI 使用额度情报，变成可信、可追溯、可行动的信息产品。</p>
        <h2>我们不做什么</h2>
        <p>不冒充 OpenAI 官方，不承诺绝对实时，不为了吸引点击制造“马上重置”之类的夸张标题。</p>
        <h2>未来方向</h2>
        <p>从单一 Tibo Reset，逐步扩展到 AI 产品额度情报、项目发现、个人提醒和团队分发工作台。</p>
      </div>
    </section>
  );
}
