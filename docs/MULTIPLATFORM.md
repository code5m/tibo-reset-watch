# ResetWatch 多端实施与接入说明

## 范围与交付状态

本版增量接入 `code5m/tibo-reset-watch`，不是另外建立五套后台。
初始升级基线为 main 的 `e492fc9738cd7552e9eafd73b38c08929d4257e6`。

代码按依赖顺序整合：
1. PR #5：共享时间与事件契约、公开事件 API、管理员校对 API 和 47 项测试。
2. PR #6：网页工作台、管理入口、桌面与移动浏览器 DOM 回归及截图归档。
3. 多端客户端：微信小程序、iOS、Android、HarmonyOS 共用 Vue3/uni-app 源码、构建前检查和本说明。

**源码入库、CI 通过、生产部署、签名安装包、真机验收、商店发布是独立状态。**
本版没有填入密钥、证书、真实 AppID 或生产域名；移动端尚未 SDK 编译、签名、真机推送验收或上架。

## 产品入口与代码位置

| 入口 | 源码 | 状态边界 |
|---|---|---|
| 网页工作台 | `apps/web/public/workbench/`；入口 `/workbench` | 网页源码；真实服务仍需部署与数据库配置 |
| 微信小程序 | `apps/client/`；目标 `mp-weixin` | 未通过微信开发者工具和真机验收 |
| iOS | 同一客户端工程的 iOS 目标 | 未生成签名 IPA / TestFlight |
| Android | 同一客户端工程的 Android 目标 | 未生成 APK / AAB |
| HarmonyOS | 同一客户端工程的 `app-harmony` 目标 | 未生成鸿蒙包，不把 APK 当作鸿蒙应用 |

小程序指微信场景；原系统的支付宝通知渠道不代表本版实现了支付宝小程序。

## 页面与交互

网页工作台提供事件、历史、内容工作室、原帖校对、客户端与通知五个入口；原有 `/admin` 导航可进入工作台。
每页一张 X 风格引用卡片，顶部同时显示北京与美国太平洋原帖发布时间，正文左解释、中译文、右英文。
卡片下部是动态当前时间、距当前推文已过时间、相对参考截止或官方确认的比较，并提供上/下条、页码和圆点。

**正在阅读的原帖与整轮事件状态独立维护。** 翻回旧预告不会把已完成事件重新显示为即将重置。
刷新尽量保留当前事件与当前原帖；手机卡片顶部翻页手势与正文三栏横向阅读分开。

客户端有事件、历史、文案、设置四个入口，原帖链接通过剪贴板复制，不伪装成已在 X 打开。
进入后台时停止前台计时与轮询；各客户端读取同一服务端事件接口，不各自抓取 X。
浏览公开事件无需采集 OpenAI 登录凭据、用户密码或个人额度。

## 一个共享规则来源

`packages/reset-core/index.js` 是唯一维护源：

```bash
node scripts/sync-platforms.mjs
node scripts/sync-platforms.mjs --check
```

脚本将模型复制到网页和 uni-app，CI 检查字节一致性，生成副本不能手工修改。
规则包括：时间必须带时区、非法日期不自动修正、未知字段不补成当前时间、演示不进入生产目录。
`by EOD` 按原帖太平洋当地日历日的下一日零点换算，仅作为参考最晚界限；实际 PDT 与原文字面 PST 不一致时保留备选说明。
官方完成确认的发帖时间与个人实际到账严格分离。Global、Banked、针对性补偿分别表示，未核实来源不自动变成官方重置。
网络失败不降级成“没有新重置”或假演示；动态时钟不表示数据健康或消息送达。

## 接入现有数据库

复用 PostgreSQL 的 `signals`、`app_settings`、`events`。原有监控、订阅、邀请奖励及分发链路保留。
`app_settings` 键 `resetwatch.catalog.v1` 保存带版本的校对目录，管理员可读取最多 100 条待审原帖。
不凭同一天或相似标题自动认定同一轮；目录上限 200 个事件，每事件最多 50 条原帖，请求体上限 256KB。
扩大业务规模时应改为规范化事件、帖子和关系表，不通过无限提高上限保存巨大 JSON。

### 公开接口

`GET /api/v1/reset-events?limit=20&offset=0`

只读、`Cache-Control: no-store`，公开只读接口允许跨域。返回 schemaVersion、serverTime、catalogUpdatedAt、events、total、nextOffset、pendingReviewCount 与真实能力开关。
未配置数据库或异常返回 503，不注入“最新官方消息”。不会返回订阅者、邮箱、手机号、Token 或数据库连接详情。

### 管理接口

`GET /api/admin/reset-catalog` 复用管理员会话，未登录返回 401，读取版本、目录及有限数量待审原帖。

`PUT /api/admin/reset-catalog` 接收 `{expectedVersion, catalog}`。复用管理员会话并校验 Origin，流式限制请求体大小。
事务、行锁与乐观版本控制防止相互覆盖；版本冲突返回 409。原帖永久链接必须匹配 Tibo 账号和帖子 ID，截止时间必须关联官方证据，同一帖不能重复归属多轮。
保存写审计记录，**不创建 Campaign、不直接发送告警或营销**。也没有把人工校对插入原有紧急预警路径，更不代表重写了原有提醒去重引擎。

### 原帖校对步骤

登录原后台，在“原帖校对”读取目录与待审内容，选择原帖后填写同轮事件 ID、类型、阶段、中文译文与解释。
只有实际核对过官方原帖，才能勾选“已对照官方原帖核实”；只有原文确实有 EOD 时才使用日终换算。
未知截止留空。先加入本地草稿，复核后保存；高级 JSON 编辑保留，不要求普通用户直接手写。

## 启动与检查

使用仓库要求的 Node.js 24，在仓库根目录执行：

```bash
npm ci
node scripts/sync-platforms.mjs --check
npm test
npm run check
npm run typecheck --workspace @resetwatch/web
npm run web:build
npm run web:dev
```

打开 Next.js 服务下的 `/workbench`；`/workbench/index.html?demo=1` 明确进入演示。
演示不会读取个人账户、向外群发或生成真实公告。

### 验证证据

PR #5（head `5c2704a82f353600c7a098ca0df1eafaabfae18d`）已通过 Tests 与 Web Build；合并提交 `6cb1368dbfa4445b4b67a85d995ef9d37076463b`。
PR #6（head `0f60bfb8c919c4f3f44503ffc4c3bd5257a9caa0`）已通过 Tests、Web Build、Workbench Browser Regression；合并提交 `6381fe991c732a84981344768a5276b1e2df299a`。
后续提交以对应 SHA 的 GitHub Actions 为准，不将历史 PASS 当作任意新提交已经通过。

- 共享契约测试 32 项；真实路由函数体测试 15 项（数据库/会话为模拟依赖）。
- 浏览器脚本包含 20 项桌面/手机 DOM 断言，接口由夹具返回；不是生产数据库端到端验收。
- `.github/workflows/workbench.yml` 保存截图与结果为 Actions artifacts。
- `.github/workflows/platform.yml` 检查共享副本一致、测试、语法和源配置；并不执行原生 SDK 构建。

复跑浏览器测试：

```bash
python -m pip install playwright==1.57.0
python -m playwright install --with-deps chromium
python scripts/test-workbench.py
```

默认使用 Playwright 安装的 Chromium。可通过 `CHROMIUM_PATH` 指定浏览器，`RESETWATCH_TEST_OUTPUT` 指定截图/报告输出目录。使用内存 DOM 与模拟 API，不访问生产用户数据。

## 微信、iOS、Android、鸿蒙构建

在支持 Vue3 的 HBuilderX 打开 `apps/client`。`config.json` 的 apiBaseUrl 填真实 HTTPS 服务域名。
`manifest.json` 填项目实际拥有的 DCloud AppID，微信目标另填微信 AppID；不要把 Secret、证书或签名口令写入仓库。

```bash
node scripts/platform-preflight.mjs mp-weixin
node scripts/platform-preflight.mjs ios
node scripts/platform-preflight.mjs android
node scripts/platform-preflight.mjs harmony
```

默认配置为空会明确阻止原生发布，这是预期行为。配置检查通过只表示配置形状合格，不等于身份真实、SDK 编译、签名或送达已经成功。

微信：在 HBuilderX 运行到微信开发者工具，核对合法 request 域名、隐私说明、页面与真实设备。
iOS/Android：使用平台对应发行流程进行构建、签名与真机测试。
鸿蒙：使用匹配版本 HBuilderX 与 DevEco 的 `app-harmony` 目标；签名、包名按真实开发者平台配置，不能用 APK 替代。
实际工具版本组合以官方兼容说明为准：
- https://uniapp.dcloud.net.cn/quickstart-cli.html
- https://uniapp.dcloud.net.cn/tutorial/harmony/runbuild.html
- https://uniapp.dcloud.net.cn/tutorial/app-manifest

## 推送与发布门禁

原站 Email/WxPusher/SMS/Alipay 保留，但本次未验证生产送达。
客户端微信订阅消息、APNs、Android/Harmony 系统推送尚未接通；必须补齐真实授权、用户/设备归属、服务端发送、重试、撤销权限、审计回执与真机测试。
不可用前台倒计时、注册成功、权限弹窗或复制订阅链接代替送达验收。
6/3/1 小时提醒和同轮去重应由服务端统一决策，不让各端重复群发。未知截止、已完成、定向补偿分别测试。
生产域名、数据库、平台账户、签名与审核仍需配置；源码已合并不能表述为全部应用已上线。

## 仓库与维护

本次按依赖顺序通过 PR 整合到原仓库，不改仓库可见性、不覆盖监控机器人产生的状态，不把已关闭且被新版替代的 PR #1 重新合入。
不提交开发者凭据、证书、私有用户数据、构建缓存或安装包；截图在 CI artifacts 中保存，测试可复现。
先前会话 ZIP/补丁是原始交付快照，GitHub 当前 main 才是后续维护主源。
