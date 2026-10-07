# ResetWatch 上线部署（首发推荐）

## 目标架构

- GitHub：唯一代码主源
- GitHub Actions：Tibo 监控 + 客户活动触发
- Vercel：Next.js 网站与 API
- PostgreSQL：用户、内容、Signal、Campaign、Delivery、Event
- Resend：邮件
- WxPusher：早期微信通道
- SMS / Alipay：通过 Provider-neutral Webhook 接入

首发阶段不要一开始购买大量云服务。先验证“用户愿不愿意留下联系方式、提醒有没有价值”。

## 1. 数据库

任选 PostgreSQL 服务，例如 Neon / Supabase / Railway / Render / 云厂商 PostgreSQL。

依次执行：

1. database/schema.sql
2. database/migrations/ 里的后续迁移（按编号）

## 2. Vercel

导入 GitHub 仓库 code5m/tibo-reset-watch。

Root Directory：

apps/web

Framework：

Next.js

环境变量至少配置：

- NEXT_PUBLIC_SITE_URL
- DATABASE_URL
- ADMIN_PASSWORD
- ADMIN_SESSION_SECRET
- UNSUBSCRIBE_SECRET
- INGEST_SECRET
- CRON_SECRET

按实际通知渠道再配置：

- RESEND_API_KEY
- FROM_EMAIL
- WXPUSHER_APP_TOKEN
- SMS_WEBHOOK_URL / SMS_WEBHOOK_SECRET
- ALIPAY_WEBHOOK_URL / ALIPAY_WEBHOOK_SECRET
- INDEXNOW_KEY

## 3. GitHub Actions Secrets / Variables

监控器：

Secrets:
- SERVERCHAN_SENDKEY（创始人自己的监控告警，可选）
- WXPUSHER_APP_TOKEN（创始人自己的监控告警，可选）
- X_BEARER_TOKEN（可选）
- INGEST_SECRET（必须与网站一致）

Variables:
- INGEST_URL=https://你的域名/api/internal/ingest

客户分发：

Secrets:
- CRON_SECRET（必须与网站一致）

Variables:
- DISTRIBUTION_URL=https://你的域名/api/internal/dispatch

## 4. 首次验收

必须逐项验证：

1. 首页手机 / 桌面正常。
2. /subscribe 能写入数据库。
3. /admin/login 可以登录。
4. /admin/subscribers 能看到刚才的订阅。
5. 创建一篇 draft 内容。
6. 创建一篇 published 内容并能打开 /insights/{slug}。
7. /sitemap.xml、/robots.txt、/llms.txt、/feed.xml 可访问。
8. 手工触发 Tibo Reset Monitor，确认 /status 有 health 数据。
9. 用测试 Campaign 只发给自己的测试订阅者。
10. 验证 deliveries 中有 sent / failed 审计记录。
11. 验证邮件退订。
12. 最后再开放真实用户注册。

## 5. 域名与品牌

首发域名应做到：
- 短；
- 容易拼；
- 不冒充 OpenAI；
- 能从 Tibo Reset 扩展到更广的 AI usage intelligence。

品牌对外使用 ResetWatch；仓库继续使用 tibo-reset-watch 不影响。

## 6. 中国用户注意

首发可以先验证需求，但如果以后面向中国大陆大规模商业运营，需要进一步评估：
- ICP / 公安备案；
- 短信实名与模板审核；
- 公众号 / 服务号资质；
- 支付宝开放平台应用资质；
- 隐私政策、用户协议与数据合规；
- 正式付费后的发票、退款与客服流程。

这些不要在没有用户验证之前一次性投入全部成本。
