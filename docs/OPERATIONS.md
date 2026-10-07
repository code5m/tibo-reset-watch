# ResetWatch 日常运营 SOP

## 每天 10 分钟

打开 /admin：

1. 看“订阅用户”增长。
2. 看“数据与健康”是否 Operational。
3. 看 delivery 是否出现连续 failed。
4. 看新 Reset / 项目线索。
5. 有真正值得解释的新信息，再发布内容；没有就不硬发。

## Reset 出现时

系统自动：

Tibo → Monitor → Ingest → signals → campaign → distribution → deliveries

人工只需要：
- 核对原帖；
- 看是否存在误判；
- 必要时补一篇解释；
- 观察订阅/点击反馈。

不要每次 Reset 都写一篇重复文章。

## 每周

记录 5 个核心数字：

- 新订阅用户
- Reset 通知打开/点击（供应商支持后接入）
- 退订人数
- 自然搜索流量
- AI / 搜索引用带来的落地页访问

首期 North Star Metric：

“收到至少一次有价值提醒后，仍保持订阅的用户数”

而不是 PV。

## 发送原则

优先级：

P0：Completed Reset
P1：Scheduled / Banked Reset
P2：监控健康故障
P3：项目日报
P4：教育内容 / 产品更新

P3/P4 不得挤压 P0/P1。

## 故障处理

### Feed stale
- 不发送“没有 Reset”的结论。
- 检查 GitHub Actions。
- 有 X_BEARER_TOKEN 时确认是否已回退官方 API。

### 网站不可用
- 创始人自己的 Server酱 / WxPusher 监控仍可独立工作。
- 恢复网站后，ingest 使用 upsert，不会因重复数据破坏时间线。

### 通知供应商异常
- deliveries 会留下 failed。
- 不把 HTTP 200 自动当成微信业务成功。
- 批量渠道故障时暂停营销类活动，Reset 可切换备用渠道。

## 数据备份

数据库正式有付费用户后：
- 开启每日备份；
- 保留至少 14-30 天；
- 每月至少做一次恢复演练。

不要只“有备份”，但从没测试能否恢复。
