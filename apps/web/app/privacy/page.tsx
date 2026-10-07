export const metadata = {
  title: "隐私说明",
  description: "ResetWatch 订阅信息、通知凭据和访问数据的处理原则。"
};

export default function PrivacyPage() {
  return (
    <article className="article-shell">
      <div className="shell article">
        <span className="kicker">PRIVACY</span>
        <h1>隐私说明</h1>
        <p className="lead">原则很简单：为了给你发送你选择的内容，我们只收集必要信息。</p>
        <h2>订阅信息</h2>
        <p>可能包括邮箱、手机号、微信/支付宝通知标识、兴趣偏好和渠道偏好。</p>
        <h2>不会做的事</h2>
        <p>不会出售订阅者联系方式；通知服务密钥不会写进数据库、公开仓库或前端代码。</p>
        <h2>分析数据</h2>
        <p>网站可能记录页面、来源和匿名事件用于改进转化漏斗，不要求采集真实姓名。</p>
        <h2>退订</h2>
        <p>正式商业化前会补齐自助退订和数据删除入口；运营后台已经保留 unsubscribed 状态。</p>
      </div>
    </article>
  );
}
