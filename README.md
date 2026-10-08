# ResetWatch

> Tibo Reset intelligence + customer subscription + distribution workbench + GEO/SEO content platform.

ResetWatch 起点是一个很小的问题：

**当 Tibo (@thsottiaux) 公布 Codex / ChatGPT Work Reset 时，怎样让中国用户及时知道、正确换算北京时间，并知道下一步该做什么？**

现在仓库已经从单一监控脚本演进为一个可创业验证的完整产品骨架。

## 当前能力

### 1. Reset intelligence

- 每 5 分钟监控 Tibo 公开动态
- Completed / Scheduled / Banked / Hint 分类
- PT / PST / PDT / UTC → Asia/Shanghai
- Feed 新鲜度保护
- 可选官方 X API 直连
- 编辑后帖子重新判断
- 去重
- 1 小时临近 Reset 二次提醒
- 监控健康状态与连续失败告警

### 2. 创始人自己的提醒

- Server酱
- Server酱³
- WxPusher
- 业务返回码校验
- 网络重试

### 3. 面向客户的网站

Next.js 应用位于：

`apps/web`

包含：

- 首页
- 免费订阅
- Reset 时间线
- AI 项目雷达
- FAQ
- 专题指南
- 定价
- 系统状态
- About / Privacy
- 动态内容页
- RSS
- sitemap.xml
- robots.txt
- llms.txt
- IndexNow

### 4. 运营工作台

`/admin`

包含：

- Dashboard
- 订阅用户 CRM
- 状态管理
- CSV 导出
- 内容创建 / 编辑 / 发布
- SEO / GEO 字段
- Campaign 创建
- 立即发送
- 自动定时发送
- 发送结果审计
- 监控健康与增长数据

### 5. 客户分发

当前适配层支持：

- Email：Resend
- WeChat：WxPusher
- SMS：Provider-neutral Webhook
- Alipay：Provider-neutral Webhook

新 Reset 的客户链路：

```text
Tibo X
  ↓
Monitor
  ↓
Authenticated Ingest API
  ↓
signals
  ↓
deduplicated Campaign
  ↓
Customer Distribution scheduler
  ↓
Email / WeChat / SMS / Alipay
  ↓
deliveries audit
```

### 6. 数据层

PostgreSQL schema：

`database/schema.sql`

核心表：

- subscribers
- signals
- project_leads
- content_items
- campaigns
- deliveries
- events
- app_settings

后续迁移位于：

`database/migrations/`

## 项目结构

```text
.
├── apps/
│   └── web/                  # Next.js 网站与工作台
├── database/
│   ├── schema.sql
│   └── migrations/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── GROWTH-GEO.md
│   ├── OPERATIONS.md
│   ├── PRODUCT-ROADMAP.md
│   └── WECHAT_SETUP.md
├── src/                      # Tibo 监控器
├── state/                    # 监控持久状态
├── test/                     # 监控器测试
└── .github/workflows/
    ├── monitor.yml
    ├── distribution.yml
    ├── test.yml
    ├── web.yml
    └── lockfile.yml
```

## 本地验证

Node.js 24+。

```bash
npm install
npm test
npm run check
npm run web:build
```

开发网站：

```bash
npm run web:dev
```

## 部署

首发推荐：

- GitHub：代码主源
- Vercel：Next.js
- Supabase / Neon 等：PostgreSQL
- Resend：Email
- WxPusher：早期微信通知

详细步骤：

`docs/DEPLOYMENT.md`

环境变量模板：

`apps/web/.env.example`

## GEO / SEO

当前策略不是批量生成垃圾页面，而是：

- people-first content
- 明确问题 / 明确答案
- 原始来源可追溯
- FAQ / Article structured data
- canonical
- sitemap
- RSS
- IndexNow
- 清晰 topic cluster
- 内容更新时间
- AI / search referral 数据

详见：

`docs/GROWTH-GEO.md`

## 第一次创业：当前最重要的成功标准

不是功能数量。

不是 PV。

不是“看起来像一家大公司”。

首期最重要的是：

> **真实用户因为 ResetWatch 至少收到过一次“及时且有用”的提醒，并愿意继续订阅。**

在这个指标成立之前，不建议投入大量成本建设复杂付费、多租户、推荐算法或几十个平台适配。

## CI 状态要求

任何正式提交都应保持：

- Monitor Tests PASS
- Node syntax gate PASS
- Web TypeScript PASS
- Next.js production build PASS
- package-lock committed

## 声明

ResetWatch 是独立第三方产品，不属于 OpenAI，也不代表 Tibo。

公开 Reset 信息应尽量保留原始来源；不确定的时间不得伪造成精确事实。


## Referral / SMS Reward

已加入合规优先的邀请增长模块：

- 每个订阅用户生成唯一邀请码。
- 好友通过邀请链接进入后记录归因。
- **分享动作本身不发奖励**；好友完成有效订阅/验证后才 qualified。
- 默认每个有效邀请奖励 3 次 Reset 短信提醒，每月最多 30 次。
- 短信奖励只用于 Reset 通知，不用于营销短信。
- 后台可审核 pending 邀请，未来短信 OTP / 邮箱验证 / 微信回调可自动调用内部 qualification API。
- 规则与部署说明见 [docs/REFERRALS.md](docs/REFERRALS.md)。
