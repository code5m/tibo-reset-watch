export const metadata = {
  title: "用户条款",
  description: "ResetWatch 服务边界、信息来源与用户责任说明。"
};

export default function TermsPage() {
  return (
    <article className="article-shell">
      <div className="shell article">
        <span className="kicker">TERMS</span>
        <h1>用户条款</h1>
        <p className="lead">ResetWatch 是第三方信息与提醒服务，不是 OpenAI 官方产品，也不代表 Tibo。</p>

        <h2>信息性质</h2>
        <p>Reset、项目线索和时间换算用于辅助决策。公开帖文可能变化，不保证适用于每个账户、套餐或地区。</p>

        <h2>可靠性边界</h2>
        <p>GitHub 调度、X 数据源、网络和第三方通知渠道都可能产生延迟或故障，因此不能承诺绝对实时或零漏报。</p>

        <h2>额度使用</h2>
        <p>用户应根据自己的真实账户状态和实际工作决定如何使用额度。ResetWatch 不鼓励为了“清空额度”制造无价值任务。</p>

        <h2>通知与退订</h2>
        <p>用户只应订阅自己有权使用的联系方式，并可通过提供的退订入口停止主动分发消息。</p>

        <h2>邀请与短信奖励</h2>
        <p>
          邀请奖励只在被邀请人独立完成有效订阅并通过系统或人工验证后发放。
          单纯分享链接、转发群聊或朋友圈不产生奖励。自邀、重复账号、虚假联系方式或其他异常行为可被拒绝。
          短信奖励用于高优先级 Reset 通知，不用于营销短信；奖励数量、月度上限和活动期限可根据短信成本与风控调整。
        </p>

        <h2>商业化</h2>
        <p>当前早期版本可能免费提供。未来收费功能、退款、发票和服务等级会在正式上线前单独说明。</p>
      </div>
    </article>
  );
}
