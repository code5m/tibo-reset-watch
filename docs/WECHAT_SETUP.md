# 微信通知配置（小白版）

推荐先用 Server酱，因为只需要一个 Secret。

## 方案 A：Server酱

1. 打开 Server酱官网并登录。
2. 按它的说明绑定你的微信通知渠道。
3. 复制 SendKey。
4. 打开本仓库 GitHub 页面。
5. 点击 Settings。
6. 左侧点击 Secrets and variables → Actions。
7. 点击 New repository secret。
8. Name 填：
   SERVERCHAN_SENDKEY
9. Secret 填你的 SendKey。
10. 保存。

保存后不需要修改代码。下一次定时任务就会自动使用它。

## 方案 B：WxPusher

在同一个 GitHub Actions Secrets 页面新增：

- WXPUSHER_APP_TOKEN
- WXPUSHER_UIDS

多个 UID 用英文逗号分隔。

## 验证

配置 Secret 后，可以进入：

Actions → Tibo Reset Monitor → Run workflow

手工触发一次。

如果当前没有新 Reset，正常情况下不会给微信发消息，这是设计行为。
如果你只是想验证代码，可看 workflow 是否成功。

## 安全提醒

不要把 SendKey、App Token、UID 写进 README、代码或 Issue。
GitHub Secrets 创建后不会把明文展示给 Actions 日志。


## 面向公开用户：WxPusher Topic

当 ResetWatch 面向公众订阅时，不要手工维护所有 UID。可在 GitHub Actions Variable 配置：

~~~text
WXPUSHER_TOPIC_ID=你的 Topic ID
~~~

用户加入 Topic 后即可统一接收 Reset 通知，`WXPUSHER_APP_TOKEN` 仍只保存在 Secret 中。这个方案适合早期验证；商业化后建议根据主体资质接入微信公众号/小程序官方消息能力。
