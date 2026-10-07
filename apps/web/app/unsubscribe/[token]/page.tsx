import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const metadata = {
  title: "退订 ResetWatch",
  robots: { index: false, follow: false }
};

export default async function UnsubscribePage({
  params
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = Boolean(verifyUnsubscribeToken(token));

  return (
    <section className="page-hero">
      <div className="shell" style={{ maxWidth: 640 }}>
        <span className="kicker">SUBSCRIPTION</span>
        <h1>管理订阅</h1>
        {valid ? (
          <div className="card">
            <h2>确认退订？</h2>
            <p className="muted">退订后将停止所有主动分发消息。你以后仍然可以重新订阅。</p>
            <form action="/api/unsubscribe" method="post">
              <input type="hidden" name="token" value={token} />
              <button className="button" type="submit">确认退订</button>
            </form>
          </div>
        ) : (
          <div className="notice error">这个退订链接无效或已经过期。</div>
        )}
      </div>
    </section>
  );
}
