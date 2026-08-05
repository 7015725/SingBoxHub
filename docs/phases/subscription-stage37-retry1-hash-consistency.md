# 订阅阶段 37 Retry 1：模块哈希一致性修复

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：50
- 模块集：`20260803.11`
- 模块数：23
- 固定提交：`ebfb9cff7740fe230041be0adfa4fe8df05d8568`
- 状态：待真机验证

## 修复内容

恢复 `src/sbh_44_subscription_crud_ui.js` 为生成时已完成 Node 语法检查和 Rhino ES5 禁用语法扫描的完整内容，使其 SHA-256 与 manifest 声明重新一致：

```text
f94c8cdc14695bedda94394ef63e4ba05bf92618eebb7e598c3442826f2ef8bc
```

入口、manifest 和全部模块固定读取同一个不可变提交。

## 保持不变

- 模块集版本仍为 `20260803.11`。
- SQLite schema 仍为版本 1。
- 订阅 CRUD 功能不变。
- 严格同步和严格加载保持启用。
- 禁止回退到 active / last-good。
- 不下载订阅。
- 不解析节点。
- 不写 Runtime 配置。
- 不启动 Core、TUN，不修改路由。

## 真机门禁

启动必须满足：

```text
entryVersion = 50
moduleSetVersion = 20260803.11
moduleSetActivated = true
sync.warning = null
sync.fallback = false
subscriptionRepositoryReady = true
subscriptionCrudUiReady = true
```

随后验证新增、编辑、脱敏预览、启停和删除。预览中 URL 查询参数必须显示为 `?<masked>`。
