export const metadata = {
  title: "免费订阅 Reset 提醒",
  description: "订阅 Codex / ChatGPT Work Reset 北京时间提醒与高信号 AI 项目日报。"
};

export default async function SubscribePage({
  searchParams
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">EARLY ACCESS</span>
          <h1>先免费订阅，<br/>不错过下一次 Reset。</h1>
          <p>
            首期重点只做好一件事：当出现真正值得行动的 Reset 信号时及时通知你。
            项目线索默认聚合成日报，不用担心被消息轰炸。
          </p>
        </div>
      </section>
      <section className="content-shell">
        <div className="shell grid-2">
          <div className="card">
            <form className="form" action="/api/subscribe" method="post">
              <input type="hidden" name="source" value="subscribe-page" />
              <div className="trap" aria-hidden="true">
                <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>

              <div className="field">
                <label htmlFor="name">怎么称呼你（可选）</label>
                <input id="name" name="name" placeholder="例如：小李" maxLength={80} />
              </div>

              <div className="field">
                <label htmlFor="email">邮箱</label>
                <input id="email" name="email" type="email" placeholder="you@example.com" />
              </div>

              <div className="field">
                <label htmlFor="phone">手机号（后续短信通道）</label>
                <input id="phone" name="phone" inputMode="tel" placeholder="+86 ..." />
              </div>

              <div className="field">
                <label htmlFor="wechatTarget">微信通知标识（可选）</label>
                <input id="wechatTarget" name="wechatTarget" placeholder="后续接公众号/企业微信/WxPusher 时使用" />
              </div>

              <fieldset className="choice-group">
                <legend>我想接收</legend>
                <label><input type="checkbox" name="interests" value="reset" defaultChecked /> Reset 高优先级提醒</label>
                <label><input type="checkbox" name="interests" value="projects" defaultChecked /> AI 项目精选日报</label>
                <label><input type="checkbox" name="interests" value="guides" /> 使用技巧与指南</label>
              </fieldset>

              <fieldset className="choice-group">
                <legend>优先通知渠道</legend>
                <label><input type="checkbox" name="channels" value="email" defaultChecked /> 邮件</label>
                <label><input type="checkbox" name="channels" value="wechat" /> 微信</label>
                <label><input type="checkbox" name="channels" value="sms" /> 短信</label>
              </fieldset>

              {params.ok ? <div className="notice success">订阅成功。欢迎成为 ResetWatch 的首批用户。</div> : null}
              {params.error === "contact" ? <div className="notice error">至少填写一种联系方式。</div> : null}
              {params.error === "format" ? <div className="notice error">邮箱或手机号格式不正确。</div> : null}
              {params.error === "database" ? <div className="notice error">网站数据库还未连接，请稍后再试。</div> : null}
              {params.error === "server" ? <div className="notice error">保存失败，请稍后重试。</div> : null}

              <button className="button" type="submit">加入早期用户</button>
              <p className="microcopy">提交即代表你同意接收所选内容；后续可随时退订。我们不会出售你的联系方式。</p>
            </form>
          </div>

          <div className="stack">
            <div className="card">
              <span className="kicker">你会收到什么</span>
              <h3>Reset 是“立即通知”，项目是“集中看”</h3>
              <p className="muted">把稀缺注意力留给真正会影响你下一步行动的信号。</p>
            </div>
            <div className="card">
              <span className="kicker">北京时间</span>
              <h3>PT / PST / PDT 不再心算</h3>
              <p className="muted">能可靠换算就直接给出 UTC+8；不能可靠换算就明确标注，不伪造精确时间。</p>
            </div>
            <div className="card">
              <span className="kicker">透明</span>
              <h3>每个核心提醒都带原始来源</h3>
              <p className="muted">你可以点回 Tibo 原帖自行核验，而不是只能相信我们的二手描述。</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
