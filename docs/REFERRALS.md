# Referral & SMS Reward System

## 产品原则

ResetWatch 的邀请奖励不是“转发奖励”。

- 分享链接、微信群、朋友圈曝光本身 **不产生奖励**。
- 只有新用户通过邀请码进入、完成订阅并被验证为有效用户后，邀请才会从 `pending` 变成 `qualified`。
- 默认每个有效邀请奖励 **3 次 Reset 短信提醒**。
- 默认每个自然月最多奖励 **30 次**。
- 短信奖励只用于 Reset 高优先级通知，不用于营销短信。

这样做既降低刷量和短信成本，也避免把产品设计成“为了奖励强迫用户分享”。

## 数据模型

- `subscribers.referral_code`：每个订阅用户唯一邀请码。
- `subscribers.sms_credits`：可用 Reset 短信额度。
- `referrals`：邀请归因与 pending / qualified / rejected 状态。
- `reward_ledger`：所有短信额度增减账本。

## 自动确认

邮箱验证、短信 OTP、WxPusher/微信关注回调、支付宝真实授权等验证流程完成后，可以调用：

~~~text
POST /api/internal/referrals/qualify
Authorization: Bearer $REFERRAL_SECRET
~~~

JSON：

~~~json
{"subscriberId":"被邀请人的 subscriber UUID"}
~~~

也支持：

~~~json
{"referralId":"referral UUID"}
~~~

如果未单独配置 `REFERRAL_SECRET`，会回退使用 `INGEST_SECRET`。

## 早期人工审核

后台 `/admin/referrals` 可以查看 pending 邀请，手工“确认有效”或“拒绝”。

## 环境变量

~~~text
REFERRAL_SMS_CREDITS=3
REFERRAL_SMS_MONTHLY_CAP=30
REFERRAL_SECRET=...
~~~

## 风控

建议后续加入：
- 手机 OTP / 邮箱 magic link。
- 同设备 / IP 高频注册阈值。
- 同手机号、邮箱唯一性继续保留。
- 新用户至少成功接收一次验证消息后才自动 qualified。
- 异常 referral code 的速率限制。
- 奖励配置、人工调整都写 reward_ledger。

## 微信传播边界

微信生态对“以奖励诱导分享、邀请助力、关注后领奖”等玩法有明确限制。因此：

- 页面可以提供正常的复制链接、系统分享和朋友圈文案。
- 不在微信分享文案中承诺“转发即可得奖励”。
- 奖励对象是后续独立产生的“有效订阅用户”，不是分享点击/曝光。
- 正式使用微信公众号/小程序能力前，再按当时最新平台规则复核活动展示方式。
