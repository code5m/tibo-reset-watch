# Tibo Reset Watch

公开的 Codex / ChatGPT Work Reset 情报与订阅服务。监控 Tibo（@thsottiaux）公开动态，识别 Global Reset、Banked Reset、已完成 Reset 和明确未来时间，把可可靠换算的时间统一显示为 **Asia/Shanghai（UTC+8）**，并保留原始 X 来源。

## v3
~~~text
Tibo public X
 → X API / verified feed
 → normalize + dedupe
 → Reset classifier
 → Public Event Feed → Web / RSS / JSON / SEO
 → Notification Router
    → ServerChan
    → WxPusher UID / Topic
    → Subscriber Gateway → WeChat / Alipay / SMS
~~~

### 已实现
- completed / scheduled / banked / hint 分类
- PT/PST/PDT/UTC → 北京时间
- X API 可选直连 + Feed 回退、stale 检测和健康告警
- Server酱 / WxPusher UID
- **WxPusher Topic 群订阅**
- **统一 Subscriber Gateway**
- **公开事件 state/public-events.json**
- **公开网页、RSS、JSON Feed、robots、sitemap、隐私页生成**
- **GitHub Pages 发布工作流**
- **多平台获客/分发手册**

### 真实账号/资质后启用
微信公众号/小程序官方消息、支付宝消息、短信 OTP/模板、用户数据库。未配置的网页入口显示“即将开放”，不会伪造已经接通。

## 验证
~~~bash
npm test
npm run check
npm run build:site
~~~

## Variables
~~~text
PUBLIC_SITE_URL=https://your-domain.example
WXPUSHER_SUBSCRIBE_URL=https://...
WXPUSHER_TOPIC_ID=123456
ALIPAY_SUBSCRIBE_URL=https://...
SMS_SUBSCRIBE_URL=https://...
~~~

## Secrets
~~~text
X_BEARER_TOKEN
SERVERCHAN_SENDKEY
WXPUSHER_APP_TOKEN
WXPUSHER_UIDS
SUBSCRIBER_GATEWAY_URL
SUBSCRIBER_GATEWAY_TOKEN
~~~

手机号、微信/支付宝用户标识、平台 Secret 禁止写进公开 GitHub state 或前端产物。

## 文档
- [订阅渠道](docs/SUBSCRIPTIONS.md)
- [增长与多平台分发](docs/DISTRIBUTION.md)
- [架构](docs/ARCHITECTURE.md)
- [微信配置](docs/WECHAT_SETUP.md)

GitHub Actions cron 属于尽力调度；追求更低延迟应配置 X API 并迁移常驻调度。第三方“预计到账”不能冒充 Tibo “已完成”。

**宁可少提醒，也不要把不确定信息伪装成确定事实。**
