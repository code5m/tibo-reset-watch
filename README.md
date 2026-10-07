# Tibo Reset Watch

一个无人值守的 Tibo X 情报监控器，主要解决两件事：

1. **额度 Reset 提醒**：监控 Tibo（@thsottiaux）公开动态，发现 Codex / ChatGPT Work 的 global reset、banked reset、已完成 reset 或明确未来 reset 时间后，通过微信提醒。
2. **高信号项目发现**：当 Tibo 明确分享或推荐 GitHub / 开源 / Agent / SDK / API / Framework / Tool 等项目线索时，低噪音提醒。

所有可可靠换算的时间统一显示为 **中国标准时间 Asia/Shanghai（UTC+8）**。

## 核心原则

- 只把 **明确、可执行** 的 Reset 信息当提醒，不做简单的 reset 关键词轰炸。
- 区分 Completed / Scheduled / Banked / Hint。
- Tibo 常见的简短确认，例如 "the reset has been processed. Enjoy!"，即使没有再次写出 Codex，也会识别为已完成 Reset。
- 不凭空补时间。只有能可靠换算时才显示精确北京时间；原帖没给时区或精确时刻时，会明确写无法可靠换算。
- 同一帖子使用 **帖子 ID + 文本哈希** 去重；帖子被编辑后可以重新判断。
- Reset 优先于项目发现，同一条帖子不会因为两套规则重复通知。

## 运行架构

~~~text
GitHub Actions（每 5 分钟）
        │
        ▼
Tibo 公共 X Feed
        │
        ▼
规范化 / 去重
        │
        ├── Reset 分类 ──► 北京时间换算 ──► 微信
        │
        └── 项目线索评分 ───────────────► 微信
        │
        ▼
state/notified.json
~~~

默认公共 Feed：

~~~text
https://tibo-reset-reminder-skill.vercel.app/api/feed
~~~

它只提供 Tibo 的公开 X 内容。项目不会上传你的微信信息、聊天内容或 GitHub Secrets 到该 Feed。

## 微信通知

支持两种方式，任选一种即可。

### A. Server酱（最简单）

在仓库：

Settings → Secrets and variables → Actions → New repository secret

新增：

~~~text
Name:  SERVERCHAN_SENDKEY
Value: 你的 Server酱 SendKey
~~~

### B. WxPusher

新增两个 Secrets：

~~~text
WXPUSHER_APP_TOKEN
WXPUSHER_UIDS
~~~

多个 UID 用英文逗号分隔。

如果两种方式都配置，会同时发送；至少一个成功才会记录为已通知。

> Secret 只存在 GitHub Actions Secrets 中，不写入代码、状态文件或日志。

详细小白配置见 docs/WECHAT_SETUP.md。

## Reset 通知示例

~~~text
🔥 Tibo Reset：已执行

Tibo：the reset has been processed. Enjoy!

发帖时间（北京时间）：2026-10-07 11:35
重置时间（北京时间）：已执行（以该帖时间作为确认时间）
类型：completed

原帖：https://x.com/thsottiaux/status/...
现在可以安排使用额度了。
~~~

## 项目线索通知

项目发现不是所有帖子都推送。至少需要两个高信号，例如：

- GitHub link + open source
- tool + great
- agent + released
- SDK + GitHub link

历史项目线索首次运行不会补发。

## 首次运行策略

1. 当前 Feed 建立为基线。
2. 如果最近 24 小时内存在一个明确、可执行的 Reset，只提醒最新一条。
3. 历史项目线索不补发。
4. 之后只处理新帖子或编辑后的新版本。

如果首次通知失败（例如还没配置微信 Secret），初始化状态不会落盘；配置完成后下一次运行会再次尝试，不会把这次 Reset 永久漏掉。

## 配置项

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| TIBO_RESET_FEED_URL | 公共 Feed | 可替换成自建 Feed |
| STATE_PATH | state/notified.json | 去重状态位置 |
| BOOTSTRAP_NOTIFY_LATEST | true | 首次是否提醒最近 Reset |
| BOOTSTRAP_MAX_AGE_HOURS | 24 | 首次允许提醒的最大年龄 |
| ALERT_ON_HINTS | false | 是否提醒模糊 Reset 线索 |
| DISCOVER_PROJECTS | true | 是否发现高信号项目 |
| DRY_RUN | false | 仅打印，不真正推送微信 |

## 本地运行

要求 Node.js 20+，无第三方 npm 依赖。

~~~bash
npm test
npm run check
npm run monitor
~~~

只看结果、不发微信：

~~~bash
DRY_RUN=true npm run monitor
~~~

## GitHub Actions

- .github/workflows/test.yml：每次 push / PR 自动执行测试和语法门禁。
- .github/workflows/monitor.yml：每 5 分钟检查一次。
- 同时只允许一个监控任务运行。
- 每次监控前先执行测试。
- 只有状态真正变化时才提交 state/notified.json。
- GitHub cron 属于尽力调度，高峰期可能延迟几分钟。

## 项目结构

~~~text
.
├── .github/workflows/
│   ├── monitor.yml
│   └── test.yml
├── docs/
│   ├── ARCHITECTURE.md
│   └── WECHAT_SETUP.md
├── src/
│   ├── classify.js
│   ├── feed.js
│   ├── monitor.js
│   ├── notifiers.js
│   ├── state.js
│   └── time.js
├── state/notified.json
├── test/
│   ├── classify.test.js
│   ├── state.test.js
│   └── time.test.js
├── .gitignore
├── package.json
└── README.md
~~~

## 故障边界

- Feed 请求失败或标记为 stale：本轮失败，不会把“抓不到”当成“没有 Reset”。
- 没有配置微信 Secret：只有真正需要发通知时才报明确错误。
- 时间不确定：保留原帖表述，不伪造精确北京时间。
- 微信通知成功后才记录为已通知，避免“状态成功但消息没发出去”。

这是一个“小而可靠”的监控器，不把它做成通用社交媒体爬虫。


## 可靠性增强（v2）

这一版针对“尽量别漏、尽量别晚、别把失败当成功”做了增强：

- **Feed 新鲜度保护**：默认要求公共 Feed 的 fetched_at 不超过 20 分钟；即使 stale 标志没置位，过旧也会判失败。
- **官方 X API 可选直连**：如果仓库额外配置 X_BEARER_TOKEN，默认 auto 模式会优先官方 X API，失败后再回退公共 Feed。这样可以绕开公共 Feed 的刷新延迟，但会使用你自己的 X API 配额。
- **微信业务码校验**：Server酱必须 code=0，WxPusher 必须 code=1000；HTTP 200 但业务失败不再被误判成成功。
- **网络重试**：通知请求遇到网络异常会自动重试。
- **连续失败告警**：连续 3 次抓取失败后发送一次“监控健康告警”，恢复后重置失败计数。
- **每日健康落盘**：每天至少写一次 state/health.json，既保留健康证据，也能避免公开仓库因长期无提交而更容易进入 GitHub 定时任务停用风险。
- **项目线索日报**：Reset 仍即时推送；“好项目”改成北京时间 20:00 后每日最多一条聚合日报，避免占用微信免费通知额度。
- **额度建议**：通知会根据已完成 / banked / 距离计划重置时间，给出如何安排真实待办的建议，不鼓励为了清零而做无价值消耗。

### 可选：官方 X API 低延迟模式

如果你已经有 X API Bearer Token，可以在 GitHub Actions Secrets 增加：

~~~text
X_BEARER_TOKEN
~~~

然后可选在 Actions Variables 设置：

~~~text
SOURCE_MODE=auto
~~~

默认就是 auto：

1. 有 X_BEARER_TOKEN：优先官方 X API。
2. X API 失败：回退公共 Feed。
3. 没有 X_BEARER_TOKEN：直接使用公共 Feed。

如果你不想承担 X API 成本，不配置即可，项目仍然可以工作。

### 需要接受的现实边界

这个项目可以显著降低漏报和误报，但不能承诺“每次绝对实时”：

- GitHub Actions 的 schedule 是尽力调度，GitHub 高峰期可能晚几分钟。
- 默认公共 Feed 也是轮询式来源，不是 X Webhook。
- 微信服务商和网络本身也可能短暂延迟。
- 如果你追求更强的实时性，应使用官方 X API + 常驻调度服务，而不是只依赖 GitHub cron。
