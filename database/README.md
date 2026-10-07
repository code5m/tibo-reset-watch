# Database

ResetWatch 使用 PostgreSQL 作为网站与运营工作台的数据源。

## 初始化

1. 创建一个 PostgreSQL 数据库（Neon、Supabase、Railway、Render Postgres、RDS 均可）。
2. 执行 `database/schema.sql`。
3. 在网站部署环境配置：
   - `DATABASE_URL`

## 数据域

- `subscribers`：订阅用户与渠道偏好
- `signals`：Reset / Banked / Scheduled 情报
- `project_leads`：高信号项目线索
- `content_items`：SEO / GEO 内容资产
- `campaigns`：分发活动
- `deliveries`：发送结果与审计
- `events`：增长与转化事件
- `app_settings`：可运营配置

任何微信、短信、邮件密钥都不进入数据库表，只存在部署平台 Secrets。
