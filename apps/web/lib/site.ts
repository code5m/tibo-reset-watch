export const site = {
  name: "ResetWatch",
  productName: "Tibo Reset Watch",
  description:
    "面向 Codex / ChatGPT Work 用户的 Reset 情报、北京时间提醒与 AI 项目发现服务。",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://tibo-reset-watch.vercel.app",
  xAccount: "https://x.com/thsottiaux",
  github: "https://github.com/code5m/tibo-reset-watch"
};

export const nav = [
  { href: "/reset", label: "Reset 时间线" },
  { href: "/projects", label: "项目雷达" },
  { href: "/guides", label: "使用指南" },
  { href: "/pricing", label: "订阅方案" },
  { href: "/invite", label: "邀请奖励" }
] as const;
