# ResetWatch 本机安全连接（v5 增量）

## 已实现的用户流程
默认仅本次连接，不自动保存恢复码。档案连接成功后，在“我的”中主动同意安全保存，才写入对应系统保管库。
再次前台打开时，先读取同一服务域名的已同意凭据，再由服务端验证档案。
清除保存可保留当前内存连接；退出、删除档案、切换服务域名会清除保存。
原生删除失败时明确报错；删除前写入的非敏感标记会禁止下次自动恢复。
小程序/Web 返回 unsupported，继续内存模式，不用 uni storage/localStorage 明文充当安全存储。

## 真实实现位置
- `apps/client/common/session-state.js`: 域名绑定、并发序列化、用户同意与恢复时序。
- `apps/client/common/secure-vault.js`: 真实 UTS 调用边界，超时、错误和回调校验。
- `apps/client/uni_modules/resetwatch-secure-session/utssdk/`: Kotlin / Swift / ArkTS 三端原生源码与 UTS 桥接。
- `apps/client/common/product.js`: 请求前核对服务域名；退出/后台/域名切换后丢弃旧响应。

## 平台保护与限制
Android：每个服务域名独立 AndroidKeyStore AES-256-GCM 密钥；随机 IV；域名作为 AAD；密文原子写入 noBackupFilesDir。删除先销毁密钥，不宣称所有设备都有 StrongBox。
Apple：应用私有 Keychain，WhenUnlockedThisDeviceOnly，禁止同步；对现有项先更新而不是先删后写。
Harmony：AssetStoreKit，DEVICE_UNLOCKED，SyncType.NEVER，无卸载持久保留请求；凭据仅存 SECRET，标签不存凭据。
不保证内存中字符串可被零化，不承诺防护已被控制的进程/设备。这不是生物识别弹窗功能。

## 构建与验证边界
同一份 Kotlin/Swift 源码由 CI 编译，不复制一份简化代码冒充验收。
`Secure Session Native Gates` 包括 Node 会话测试、iOS simulator SDK 类型检查、macOS 真实 Keychain 读写删除测试、Android 库编译与 lint。
测试只使用随机 .invalid 域名与测试凭据，完成后删除测试条目。
Vue 浏览器测试仅模拟原生边界，不是原生设备测试。
**完整 HBuilderX UTS 混编、DevEco 编译、真机锁屏/重启/卸载验收仍需要真实宿主工程，本次不将它们标为通过。**
不替换已配置的通知与订阅服务，不开启生产发送，不提交真实证书和 AppID。

## 可复跑命令
```sh
node --test test/client-session.test.mjs test/client-bindings.test.mjs
npm test
CLIENT_COMPILER_ROOT=/tmp/rw-client-compiler node scripts/compile-client-fixture.mjs
python scripts/test-client-ui.py
gradle -p native/secure-session/android assembleDebug lintDebug
```

## 官方依据
- https://doc.dcloud.net.cn/uni-app-x/plugin/uts-plugin-hybrid.html
- https://developer.android.com/privacy-and-security/keystore
- https://developer.apple.com/documentation/security/ksecattraccessiblewhenunlockedthisdeviceonly
- https://github.com/openharmony/interface_sdk-js/blob/master/api/@ohos.security.asset.d.ts
