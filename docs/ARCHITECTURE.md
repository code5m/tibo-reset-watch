# Architecture

## 目标

Tibo Reset Watch 只做两个高价值信号：

1. Codex / ChatGPT Work Reset。
2. Tibo 分享的高信号项目 / 工具。

它不是通用 X 抓取框架。

## 数据流

1. GitHub Actions 每 5 分钟运行。
2. 读取公开 Feed。
3. 将帖子规范化成 id / text / createdAt / url / versionKey。
4. 根据 versionKey 去重。
5. Reset 分类优先。
6. 非 Reset 帖子才进入项目线索评分。
7. 通知成功后写入 notified。
8. 本轮处理完成后原子写入 state/notified.json。

## 安全边界

- 微信凭据只从 GitHub Actions Secrets 读取。
- state 文件只保存公开帖子 ID、文本哈希和通知状态。
- 不记录 Secret。
- Feed 失败或 stale 时直接失败，不产生“没有 Reset”的错误结论。

## 时间策略

- 输出统一使用 Asia/Shanghai。
- PT/PST/PDT 统一按 America/Los_Angeles 解释，由运行时自动处理 DST。
- UTC/GMT 明确按 UTC 解析。
- 原帖没有时区时，不猜具体时刻。

## 去重策略

versionKey = post ID + text SHA-256 短哈希。

这样既不会重复提醒同一版本，又允许帖子编辑后重新判断。

## 状态一致性

初始化只有在需要的首次通知成功后才会落盘。
正常运行中，单条通知成功后才写 notified，最终使用临时文件 + rename 原子更新状态。
