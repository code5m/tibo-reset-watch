# Subscription Channels

监控核心只产生结构化事件，通知层负责分发。

## Subscriber Gateway
配置 `SUBSCRIBER_GATEWAY_URL`，可选 `SUBSCRIBER_GATEWAY_TOKEN` Bearer 鉴权。网关接收结构化 Reset Event，再分发到微信官方渠道、支付宝和短信。

## 微信
当前支持 WxPusher UID 与 Topic：
- `WXPUSHER_APP_TOKEN`：Secret
- `WXPUSHER_TOPIC_ID`：Actions Variable
- `WXPUSHER_SUBSCRIBE_URL`：Actions Variable

正式商业化后按主体与账号资质补充微信公众号/小程序官方消息能力；不要使用模拟个人微信登录机器人。

## 支付宝
支付宝做成 Subscriber Gateway provider adapter。拿到真实开放平台应用和用户授权后再启用 `ALIPAY_SUBSCRIBE_URL`。Secret 只存在服务端。

## 短信
手机号必须验证后才能成为 active subscriber：提交 → OTP → 验证 → active → Reset 通知 → 可退订。正式用户数据使用持久数据库，不提交到 Git。
