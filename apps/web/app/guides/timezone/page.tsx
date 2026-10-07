export const metadata = {
  title: "PT / PST / PDT 怎么换算成北京时间｜Tibo Reset 时间换算",
  description: "解释 Tibo 常用的 PT、PST、PDT 与北京时间 UTC+8 的关系，以及为什么应该用时区数据库而不是固定加减小时。"
};

export default function TimezoneGuide() {
  return (
    <article className="article-shell">
      <div className="shell article">
        <span className="kicker">GUIDE · TIMEZONE</span>
        <h1>PT / PST / PDT 怎么换成北京时间？</h1>
        <p className="lead">
          不要永远固定“加 16 小时”或“加 15 小时”。美国太平洋时间有夏令时变化，
          最可靠的做法是把 PT 解析为 America/Los_Angeles，再转换到 Asia/Shanghai。
        </p>

        <h2>PST 和 PDT 为什么不一样</h2>
        <p>PST 是 UTC-8，PDT 是 UTC-7；中国标准时间全年是 UTC+8，不实行夏令时。</p>

        <h2>为什么 “PT” 更需要谨慎</h2>
        <p>
          PT 是“太平洋时间”的泛称，具体是 PST 还是 PDT 取决于日期。
          因此程序应该使用时区规则自动判断，而不是写死偏移量。
        </p>

        <h2>如果 Tibo 只说 “tomorrow 10am” 呢？</h2>
        <p>
          如果上下文没有明确时区，ResetWatch 不会伪造一个精确北京时间。
          宁可告诉用户“无法可靠换算”，也不应该给一个看起来很精确但可能是错的时间。
        </p>
      </div>
    </article>
  );
}
