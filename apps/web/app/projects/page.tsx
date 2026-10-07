import { getProjectLeads } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI 项目雷达",
  description: "从 Tibo 的公开动态中筛选 GitHub、Agent、MCP、SDK、API 与开源项目高信号线索。"
};

export default async function ProjectsPage() {
  const items = await getProjectLeads();

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">PROJECT RADAR</span>
          <h1>项目雷达</h1>
          <p>不是把所有推文搬过来，而是筛选更值得你投入 AI 时间和额度的项目、工具与开发能力。</p>
        </div>
      </section>
      <section className="content-shell">
        <div className="shell grid-2">
          {items.map(item => (
            <article className="card project-card" key={item.id}>
              <div className="project-score"><span>信号分</span><strong>{item.score}</strong></div>
              <h2>{item.title}</h2>
              <p className="muted">{item.summary}</p>
              <div className="tag-row">{item.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
              <a className="text-link" href={item.sourceUrl} target="_blank" rel="noreferrer">查看原帖 →</a>
            </article>
          ))}
          {!items.length ? <div className="card"><h2>项目雷达正在积累数据</h2><p className="muted">监控到符合高信号规则的项目后，会出现在这里。</p></div> : null}
        </div>
      </section>
    </>
  );
}
