export default async function AdminLogin({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <section className="page-hero">
      <div className="shell" style={{ maxWidth: 520 }}>
        <span className="kicker">运营后台</span>
        <h1 style={{ fontSize: 48 }}>登录工作台</h1>
        <p>使用部署环境中的 ADMIN_PASSWORD 登录。密码不会存入数据库。</p>

        <div className="card" style={{ marginTop: 28 }}>
          <form className="form" action="/api/admin/login" method="post">
            <div className="field">
              <label htmlFor="password">管理员密码</label>
              <input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            {params.error ? <div className="notice error">密码错误或尚未配置。</div> : null}
            <button className="button" type="submit">进入工作台</button>
          </form>
        </div>
      </div>
    </section>
  );
}
