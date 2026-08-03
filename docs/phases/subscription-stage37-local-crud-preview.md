# 订阅阶段 37：客户端 SQLite CRUD 与只读预览

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 隔离入口：`entry/SingBoxHub.stage37.subscription-crud.js`
- 入口版本：`49`
- 模块集：`20260803.11`
- 模块数：23
- 状态：待真机验证

## 阶段目标

建立订阅记录的本地数据链，不下载订阅、不解析节点、不写 Runtime 配置。

## 新增模块

### `src/sbh_43_subscription_repository.js`

- SHA-256：`5143a9a36e7527b629e574dfc55e9233411bd9322bbcdb8defefad5533e08972`
- 建立 `subscriptions` SQLite 表和更新时间索引。
- 支持新增、查询、编辑、启停、删除和计数。
- 订阅名称限制 1–64 字符。
- URL 限制为 HTTP/HTTPS，拒绝 URL 用户名和密码。
- 订阅 URL 唯一，防止重复写入。
- 只读预览隐藏 query 内容，只保留 `?<masked>` 标记。

### `src/sbh_44_subscription_crud_ui.js`

- SHA-256：`f94c8cdc14695bedda94394ef63e4ba05bf92618eebb7e598c3442826f2ef8bc`
- 覆盖节点页中的订阅界面。
- 提供新增、编辑、启停、删除和只读预览。
- “填充示例”只填写输入框，不自动保存，也不访问网络。

## 数据表

`subscriptions` 字段：

- `id`
- `name`
- `url`
- `enabled`
- `remark`
- `node_count`
- `last_checked_at`
- `last_error`
- `created_at`
- `updated_at`

## 安全边界

- 允许修改客户端数据库 `SingBoxHubClient/data/singboxhub.db`。
- 禁止访问订阅 URL。
- 禁止写 Runtime 配置。
- 禁止启动或停止 Core。
- 禁止创建 TUN。
- 禁止修改路由。
- 不增加 Runtime LocalSocket 请求。

## 真机门禁

启动输出应满足：

- `entryVersion=49`
- `moduleSetVersion=20260803.11`
- `expectedModuleCount=23`
- `moduleSetActivated=true`
- `subscriptionRepositoryReady=true`
- `subscriptionCrudUiReady=true`
- `subscriptionNetworkAccessed=false`
- `subscriptionRuntimeConfigModified=false`

UI 验证：

1. 节点页显示“订阅数据链”。
2. 点击“填充示例”只填写表单。
3. 保存后产生一条订阅卡片。
4. 编辑名称或备注后保存成功。
5. 预览中的 query 显示为 `?<masked>`，不得暴露 token。
6. 启停状态可切换。
7. 删除后记录消失。
8. 首页 Runtime 状态和反馈继续正常。

## 后续门禁

本阶段通过后再提升正式入口。下一阶段才允许设计订阅下载、响应大小限制、超时、重定向、内容类型和节点解析；仍不得直接写 Runtime 配置。
