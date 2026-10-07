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
