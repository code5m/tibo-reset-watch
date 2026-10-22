# ResetWatch 产品设计实施 v5

## 交付与主源
本版承接设计 PR #8，以及业务后端 #9、工作台与客户端 #10。所有产品源码维护在同一 GitHub 仓库，继续保留原监控、订阅及运营后台。
生产接口、演示数据、浏览器回归、原生 SDK 验证与真实送达分别记录，不合并成一个“已完成”。

## 功能地图
| 设计区域 | 实现入口 | 验收边界 |
|---|---|---|
| 实时事件 | `/workbench`；客户端“动态” | 三栏分页、双时区、校准时钟、截止/完成状态、数据新鲜度 |
| 证据与历史 | 工作台“证据与历史”；客户端“历史” | 搜索已加载记录、按事件类型筛选；未知数据不猜测 |
| 告警与送达 | 工作台/客户端提醒 | 档案、免打扰、6/3/1 偏好、设备授权、撤销、真实服务端消息记录 |
| 内容工作室 | Web 运营界面；客户端分享文案 | 告警/传播稿分开；后台存草稿、记录外部发布，不自动公开发布 |
| 产品设置 | Web 设置；客户端“我的” | 三种主题、恢复码、隐私说明、导出、删除、可信服务地址 |
| 使用安排 | Web 侧栏；客户端“我的” | 服务端任务、完成状态、事件收藏；不自动执行代码 |
| 团队空间 | Web 侧栏；客户端“我的” | 单次邀请、角色权限、共享任务；成员管理与删除在 Web 所有者界面 |
| 小组件 | Web 独立组件 + native/widgets | iOS/Android/Harmony 接收同一公开摘要；系统调度不等于秒级告警 |
| 其他来源 | 服务端来源能力目录 | 仅 Tibo 当前可用；没有接入的供应商不显示“在线” |

## 核心状态约束
一个 Reset 内的多条推文是同一事件。翻回旧预告不回滚已完成状态。
仅 EOD 时按原帖太平洋当地日期换算参考最晚界限，保留 PST/PDT 歧义。
官方发帖确认时间不代表个人账户到账时间。小组件不独立解析英文或计算 EOD，而读取同一服务端摘要。

## 网页与客户端
网页提供主导航五项以及任务/团队/小组件次级入口；微信公众号使用独立传播文案，不宣称聊天通知支持网页翻页。
微信小程序采用动态/历史/我的三项，提醒在我的内部；其他三个客户端为动态/历史/提醒/我的四项。
手机正文横滑查看三栏、头部滑动翻页。计时仅前台持续刷新；后台停止前台轮询。
服务端不可用时保留失败和新鲜度提示，不自动回退演示。

网页使用 HttpOnly Cookie。移动端默认仅保留内存；后续安全存储增量已提供主动同意的 Keychain / Keystore / AssetStore 桥接源码。详见 `native/secure-session/README.md`；完整 HBuilderX / DevEco 宿主编译和真机验收仍需单独核对。小程序与 Web 客户端不使用明文存储降级。
临时恢复码在弹窗关闭/客户端隐藏时清除；不写 localStorage、普通 uni storage、公开日志或源码。
服务域名切换需要明确确认并清除旧会话，不会把原恢复码发送到新域名。
演示阻止档案、任务、草稿、目录与推送写入。网页静态 PWA 只缓存壳文件，API/用户数据不缓存。

## 服务端上线顺序（本轮没有运行生产迁移）
1. 备份并核对已有 PostgreSQL。首次部署执行 `database/schema.sql`，升级按现有迁移顺序执行到 `006_product_design.sql`；禁止在错误库运行。
2. 将 Web 服务部署到实际 HTTPS 域名并设置数据库、原管理员认证、PRODUCT_WORKER_SECRET（至少32字符）。
3. 通过档案创建、偏好保存、版本冲突、团队只读用户、导出/删除完成真实环境验收。
4. 原帖管理员校对目录与原始信号；原告警链路保留，本次不强行插入人工审核去延迟原告警。
5. 可先只启用站内提醒规划，原生发送保持关闭。`node scripts/run-product-worker.mjs --plan` 要求服务端环境，不能放进手机。

## 推送中继
`uniCloud/cloudfunctions/resetwatch-relay/` 是 HTTPS URL 化中继，接收服务端签名的定向请求。
使用 ≥32 字符 HMAC 密钥、5分钟时间窗、32KB 请求上限、持久化幂等登记和单个明确目标。
缺少 CID 不调用 uni-push，防止平台默认全量目标行为。中继和主服务两个发送开关默认均关闭。
数据库声明禁止客户端读取或修改 ledger；该表只存请求哈希、状态和非收件人相关的结果，不存 OpenID/CID/正文。

配置位置：
- Web 环境：`PRODUCT_DEVICE_KEY` 64位hex、`PRODUCT_PUSH_RELAY_URL` HTTPS、`PRODUCT_PUSH_RELAY_SECRET`、`PRODUCT_SEND_ENABLED=false`。
- 云函数环境：相同 `PRODUCT_PUSH_RELAY_SECRET`，`RELAY_SEND_ENABLED=false`，原生 `DCLOUD_APP_ID`。
- 微信还需服务器端 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`WECHAT_TEMPLATE_ID`、按已批准模板填写 `WECHAT_TEMPLATE_FIELDS`。
- 模板映射例形状：`{"thing1":{"source":"title","maxLength":20}}`。这只是映射格式，不是你已获批的模板，不可直接声称能发送。
- 云函数 package 指定 Nodejs18 和 uni-cloud-push 扩展，URL 路径默认空；部署时由实际空间管理员明确开启。

客户端只有用户主动点击才申请系统授权；微信在订阅同意后发送一次性登录 code，OpenID 由服务端换取。
同意或设备登记不等于无限次微信订阅、服务商接受、设备收到或人已经阅读。
首次和重复自动执行使用同一 requestId，持久化中继不会再次发送。
未知结果不自动重试。用户明确确认重复风险后才生成新 requestId；原 deliveryId 保持不变以关联回执。
已有收到/打开回执时拒绝再次重试。发送后的最终实际状态仍要核对客户端回执。
并发回执按队列序列化，避免保存旧快照时丢掉新抵达的消息。

## 定时调度
`.github/workflows/product-worker.yml` 提供按小时、可手动触发的 worker，只有 `PRODUCT_WORKER_ENABLED=true` 才执行。
规划与发出分别控制；发送还需要 `PRODUCT_SEND_ENABLED=true` 及服务器同名开关。
本轮没有设置这些变量/密钥、没有启用生产 worker。GitHub 定时可能延迟，不承诺公告发布到提醒零延迟。
部署到生产时，应采用可靠常驻/队列调度承接新信号，并观测“发布→发现→排队→提供商接受→回执”的时间。
原有监控状态及已有订阅分发不因这次新增设计被删除或覆盖。

## 原生小组件
详见 `native/widgets/README.md`。iOS WidgetKit 为 iOS17+扩展源；Android 为独立 AppWidget 库；Harmony 为 FormExtensionAbility 与 ArkTS 卡片集成源码。
没有将 WidgetKit 类型检查或 Android AAR 当作完整客户端 IPA/APK/HAP，也没有发布应用。
平台未配置、网络错误或无有效摘要均显示未知；不把 API 故障当成“没有 Reset”。

## 回归命令
```sh
node scripts/sync-platforms.mjs --check
npm test
npm run check
npm run typecheck --workspace @resetwatch/web
npm run web:build
python scripts/test-workbench.py
python scripts/test-product-ui.py
CLIENT_COMPILER_ROOT=/tmp/rw-client-compiler node scripts/compile-client-fixture.mjs
python scripts/test-client-ui.py
node --test test/relay.test.mjs test/client-bindings.test.mjs
```
浏览器测试用本地 DOM 与隔离 API 夹具；移动端先编译真实 Vue 源再在浏览器模拟 uni 接口。均不能替代原生运行时、辅助功能或推送真机测试。
原生 widget CI 分别运行真实 iOS simulator SDK 类型检查与 Android library build/lint。Harmony 无 DevEco 签名宿主时不得记为通过。
安全检查包含原文 XSS、未知状态、冲突不覆盖、游客不自动注册、授权拒绝、定向推送不群发与未知结果不重发。

## 发布前未完成的外部条件
真实生产域名/数据库配置、微信与 DCloud AppID、模板审批、Apple/Android/Harmony证书与宿主构建、设备通知通道、真机回执、隐私和商店审核。
这些是发布门禁，不使用虚构示例值绕过。之前的内容包与预览不是安装包。

## 资料
- https://doc.dcloud.net.cn/uniCloud/uni-cloud-push/api.html
- https://doc.dcloud.net.cn/uniCloud/http
- https://doc.dcloud.net.cn/uniCloud/cf-functions.html
- https://developer.apple.com/documentation/widgetkit/timelineprovider
- https://developer.android.com/develop/ui/views/appwidgets/advanced
- https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html
- https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-ui-widget-lifecycle

微信和华为部分文档本轮网页读取受限；相关授权、模板及 ArkTS 构建必须在实际平台工具中再验，不用第三方摘录替代平台验收。
