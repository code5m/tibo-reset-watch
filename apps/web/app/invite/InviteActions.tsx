"use client";

import { useState } from "react";

export default function InviteActions({
  inviteUrl,
  code
}: {
  inviteUrl: string;
  code: string;
}) {
  const [message, setMessage] = useState("");
  const shareText = `我在用 ResetWatch 盯 Codex / ChatGPT Work 的 Reset。它会把 Tibo 的关键信号换算成北京时间，还保留原始 X 来源：${inviteUrl}`;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(label + "已复制");
    } catch {
      setMessage("复制失败，请手动复制");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ResetWatch",
          text: "不错过下一次 Codex / ChatGPT Work Reset",
          url: inviteUrl
        });
        setMessage("已打开系统分享");
        return;
      } catch {}
    }
    await copy(inviteUrl, "邀请链接");
  }

  return (
    <div className="stack">
      <div className="share-box">
        <div>
          <span className="kicker">你的邀请码</span>
          <strong>{code}</strong>
        </div>
        <button className="inline-action" type="button" onClick={() => copy(inviteUrl, "邀请链接")}>
          复制链接
        </button>
      </div>
      <div className="share-actions">
        <button className="button" type="button" onClick={share}>发给好友 / 群聊</button>
        <button className="button button-ghost" type="button" onClick={() => copy(shareText, "分享文案")}>
          复制朋友圈文案
        </button>
      </div>
      {message ? <div className="notice success">{message}</div> : null}
      <p className="microcopy">
        分享是自愿行为。好友通过邀请链接独立完成有效订阅后才计算奖励；单纯转发、群发或朋友圈曝光不计奖励。
      </p>
    </div>
  );
}
