export const metadata = {
  title: "已退订",
  robots: { index: false, follow: false }
};

export default function UnsubscribeSuccessPage() {
  return (
    <section className="page-hero">
      <div className="shell" style={{ maxWidth: 640 }}>
        <span className="kicker">DONE</span>
        <h1>已经退订。</h1>
        <p>我们会停止向这个订阅者发送主动消息。以后想回来，重新提交订阅表单即可。</p>
        <a className="button button-ghost" href="/">返回首页</a>
      </div>
    </section>
  );
}
