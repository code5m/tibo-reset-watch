import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";

const adminNav = [
  ["/admin", "总览"],
  ["/admin/subscribers", "订阅用户"],
  ["/admin/referrals", "邀请奖励"],
  ["/admin/content", "内容"],
  ["/admin/campaigns", "分发活动"],
  ["/admin/data", "数据"]
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">R</span>
          <span>ResetWatch</span>
        </Link>
        <div className="admin-label">WORKBENCH</div>
        <nav>
          {adminNav.map(([href, label]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <form action="/api/admin/logout" method="post">
          <button className="admin-logout" type="submit">退出登录</button>
        </form>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
