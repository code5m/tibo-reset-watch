import Link from "next/link";
import InviteActions from "./InviteActions";
import { getReferralSummary, referralMonthlyCap, referralRewardCredits } from "@/lib/referrals";
import { site } from "@/lib/site";

export const metadata = {
  title: "邀请好友 · 短信提醒奖励",
  description: "邀请好友成为 ResetWatch 有效订阅用户，获得 Codex / ChatGPT Work Reset 短信提醒额度。"
};

export default async function InvitePage({
  searchParams
}: {
  searchParams: Promise<{ code?: string; joined?: string }>;
}) {
  const params = await searchParams;
  const code = String(params.code || "").trim();
  const summary = code ? await getReferralSummary(code) : null;
  const reward = referralRewardCredits();
  const monthlyCap = referralMonthlyCap();

  if (!summary) {
    return (
      <>
        <section className="page-hero">
          <div className="shell">
            <span className="kicker">REFERRAL REWARDS</span>
            <h1>邀请真正需要的人，<br/>换 Reset 短信提醒。</h1>
            <p>
              奖励不与“转发动作”绑定。好友独立完成有效订阅后，邀请人才获得短信提醒额度。
            </p>
          </div>
        </section>
        <section className="content-shell">
          <div className="shell grid-2">
            <div className="card">
              <h3>先完成自己的订阅</h3>
              <p className="muted">订阅成功后会生成你的专属邀请码和邀请链接。</p>
              <Link className="button" href="/subscribe">免费订阅并获取邀请码</Link>
            </div>
            <div className="card">
              <span className="kicker">奖励规则</span>
              <h3>有效邀请 = 短信通知额度</h3>
              <p className="muted">
                每个有效邀请默认奖励 {reward} 次 Reset 短信提醒，每个自然月最多奖励 {monthlyCap} 次。
                短信额度只用于高优先级 Reset 提醒，不用于营销短信。
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  const inviteUrl = site.url + "/subscribe?ref=" + encodeURIComponent(summary.code) + "&utm_source=referral";

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <span className="kicker">REFERRAL REWARDS</span>
          <h1>邀请好友，<br/>把奖励变成真正有用的提醒。</h1>
          <p>
            每个有效邀请默认奖励 {reward} 次 Reset 短信提醒。短信额度只在重要 Reset 通知时消耗。
          </p>
          {params.joined ? <div className="notice success">订阅成功，你的邀请码已经生成。</div> : null}
        </div>
      </section>

      <section className="content-shell">
        <div className="shell">
          <div className="reward-metrics">
            <div className="card"><span className="muted">短信余额</span><div className="metric">{summary.smsCredits}</div><small>次 Reset 提醒</small></div>
            <div className="card"><span className="muted">有效邀请</span><div className="metric">{summary.qualified}</div><small>已确认</small></div>
            <div className="card"><span className="muted">待确认</span><div className="metric">{summary.pending}</div><small>等待验证</small></div>
            <div className="card"><span className="muted">累计奖励</span><div className="metric">{summary.creditsEarned}</div><small>次短信额度</small></div>
          </div>

          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="card">
              <span className="kicker">SHARE</span>
              <h3>把 ResetWatch 发给真正需要的人</h3>
              <InviteActions inviteUrl={inviteUrl} code={summary.code} />
            </div>
            <div className="card">
              <span className="kicker">规则</span>
              <h3>奖励有效用户，不奖励刷屏</h3>
              <div className="stack muted">
                <p>1. 好友必须通过你的邀请链接进入并完成有效订阅。</p>
                <p>2. 分享、复制链接、发朋友圈本身不产生奖励。</p>
                <p>3. 自邀、重复账号、批量虚假联系方式可以被拒绝。</p>
                <p>4. 每个有效邀请默认 +{reward} 次短信提醒；每月最多奖励 {monthlyCap} 次。</p>
                <p>5. 短信奖励仅用于 Reset 类高优先级通知，不发送营销短信。</p>
              </div>
              <Link className="text-link" href="/terms">查看完整用户条款 →</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
