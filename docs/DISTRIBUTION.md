# 用户增长与多平台分发

ResetWatch 的增长闭环：

~~~text
Tibo 原始信息
→ 自动判定 Reset
→ 网站可搜索时间线
→ 多平台内容分发
→ 免费订阅
→ Reset 真发生时可靠送达
→ 用户分享
~~~

## 分发优先级

- P0：X、GitHub、V2EX、Linux.do、RSS。
- P1 中国：微信公众号、知乎、小红书、B站、掘金/CSDN。
- P1 国际：Reddit、Show HN、Product Hunt。

## 首发素材

### X

I built ResetWatch for heavy Codex / ChatGPT Work users.

It watches @thsottiaux for actionable reset signals, distinguishes announced / completed / banked resets, converts timing to China Standard Time, and keeps the original source.

Free timeline + alerts: {SITE_URL}

### V2EX / Linux.do

标题：做了一个 ResetWatch：自动盯 Tibo 的 Codex / ChatGPT Work Reset，并换算北京时间

正文重点：
- completed / scheduled / banked 分开；
- PT / UTC 自动换北京时间；
- 每条核心提醒保留 Tibo 原帖；
- 支持网页时间线和订阅；
- 项目开源，可反馈误报、漏报和渠道需求。

## 各平台内容策略

- 微信公众号：Reset 快讯 + 每周复盘。
- 知乎：回答“Codex Reset 是什么”“Banked Reset 有什么区别”等搜索问题。
- 小红书：做“状态 + 北京时间 + 原帖”的卡片图文。
- B站：1–3 分钟演示 X → ResetWatch → 通知。
- 掘金/CSDN：发布开源架构、监控与时区处理文章。
- Reddit：遵守社区规则，以工具价值和数据为主，不刷广告。
- Show HN / Product Hunt：至少一种真实通知渠道稳定、有历史 Reset 数据后再发布。

## 每条 Reset 的标准模板

必须包含：
1. ANNOUNCED / COMPLETED / BANKED 状态。
2. 北京时间。
3. 明确适用范围（只有原始证据明确时才写）。
4. 一句话解释。
5. Tibo 原始 X permalink。
6. ResetWatch 订阅入口。

禁止把“预计”写成“已完成”，禁止把第三方推测冒充 Tibo 官方确认，禁止未经用户同意发送营销消息。

## SEO / GEO

围绕真实用户问题建设：
- Codex Reset
- ChatGPT Work usage limit
- Global Reset vs Banked Reset
- PST / PDT / PT 到北京时间
- Tibo Reset history

页面必须有真实来源、更新时间、状态和直接答案，不批量制造低质量关键词页面。

## 增长指标

- 访问 → 订阅转化率
- 来源渠道
- 有效订阅用户数
- 通知送达率 / 退订率
- Reset 误报 / 漏报率
- Tibo 发帖 → 检测 P50/P95
- 检测 → 用户收到通知 P50/P95

北极星指标：**真正出现 Reset 时，有多少订阅用户及时收到并信任通知。**
