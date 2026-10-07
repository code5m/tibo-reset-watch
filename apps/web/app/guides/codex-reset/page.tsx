import Link from "next/link";

export const metadata = {
  title: "Codex Reset 是什么？如何判断额度已经重置",
  description: "Codex / ChatGPT Work Reset 判断指南：区分已完成、计划重置和模糊线索，并解释如何查看自己的真实剩余额度。"
};

export default function CodexResetGuide() {
  return (
    <article className="article-shell">
      <div className="shell article">
        <span className="kicker">GUIDE · CODEX RESET</span>
        <h1>Codex Reset 是什么？如何判断“已经重置”</h1>
        <p className="lead">
          最简单的判断：只有出现明确的完成语义，例如 “reset has been processed / completed”，
          才应该把它视为“已经发生”；“soon”“working on it”或一个未来时间都不是已完成。
        </p>

        <h2>三类最容易混淆的信号</h2>
        <h3>1. Completed</h3>
        <p>明确表示 Reset 已经处理或完成。ResetWatch 会把这类信号设为最高优先级。</p>
        <h3>2. Scheduled</h3>
        <p>说明未来某个时间会 Reset。它适合做“提前安排”，但不能当成当前额度已经恢复。</p>
        <h3>3. Hint</h3>
        <p>例如 soon、maybe、trying。这类内容可以作为背景信息，但默认不应该触发高优先级通知。</p>

        <h2>公开 Reset ≠ 你账户的实时剩余额度</h2>
        <p>
          Tibo 的公开说明可以告诉你“平台发生了什么”，但不能读取你的个人账户还剩多少。
          临近 Reset 时，最合理的做法是再去你自己的 Usage 页面或 Codex 状态里确认真实剩余量。
        </p>

        <h2>怎样更合理地使用剩余额度</h2>
        <p>
          优先选择本来就值得做、但适合交给 AI 的工作：代码审查、测试补齐、文档整理、研究比较、
          重构候选分析、批量内容整理。不要为了“数字归零”制造没有产出的任务。
        </p>

        <div className="article-cta">
          <strong>不想每次自己判断？</strong>
          <Link className="button" href="/subscribe">免费订阅 Reset 提醒</Link>
        </div>
      </div>
    </article>
  );
}
