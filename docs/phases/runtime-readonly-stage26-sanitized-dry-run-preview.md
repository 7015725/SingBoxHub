# Runtime 只读适配阶段 26：脱敏 dry-run 预览与适配计划归一化

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.20`
- 入口最低版本：`23`
- 新增模块：`src/sbh_26_runtime_sanitized_dry_run_preview.js`
- 模块 SHA-256：`6db4aa28dab493804048c107ae3cb57ef20f4170a16d74c5a818fdbe4106e530`
- 状态：真机验证通过；首次更新运行已直接得到最终预览；真实 Socket dry-run 尚未授权

## 1. 阶段目标

第 25 阶段已经确认只读 PING 单事务静态契约，但旧适配计划仍保留 `COMMAND_CARRIER_DECLARED` 和 `CORRELATION_FIELD_DECLARED` 两项历史阻断。本阶段一次性完成：

1. 将第 25 阶段证据正式回写适配计划；
2. 清除旧阻断项并重算 `requiredEvidence`、`satisfiedEvidence` 和 `blockers`；
3. 生成不读取 token 原值的三行请求预览；
4. 生成 `PONG + correlation echo` 的两行响应预览；
5. 固定命令只允许 `PING`；
6. 保持真实 Socket、认证值读取和报文发送全部禁用。

## 2. 节约步骤设计

本模块不再读取 JAR、不执行 Shell、不重新分析 DEX，只消费第 25 阶段持久缓存。`runtime.status()` 和 `SBH.app.start()` 同步完成归一化和预览构造。

真机结果证明该设计有效：升级入口后的第一次执行已经直接返回最终状态，不需要等待后再次执行才能判断阶段是否通过。第二次执行只用于确认缓存启动耗时。

## 3. 真机验证结果

### 3.1 首次更新运行

```json
{
  "entryVersion": 23,
  "moduleSetVersion": "20260802.20",
  "sync.updated": true,
  "sync.downloadedCount": 26,
  "sync.warning": null,
  "runtimeSanitizedDryRunPreview": "sanitized_dry_run_preview_ready",
  "runtimeProtocolAdapterPlan": "sanitized_preview_ready",
  "durationMs": 14623
}
```

虽然首次运行需要下载和校验 26 个模块，但第 26 模块已直接返回最终结果，没有出现 `checking` 中间状态。

### 3.2 缓存运行

```json
{
  "entryVersion": 23,
  "moduleSetVersion": "20260802.20",
  "sync.updated": false,
  "sync.downloadedCount": 0,
  "sync.warning": null,
  "runtimeSanitizedDryRunPreview": "sanitized_dry_run_preview_ready",
  "runtimeProtocolAdapterPlan": "sanitized_preview_ready",
  "durationMs": 1006
}
```

结论：后续普通启动约 1 秒完成，不需要重复执行进行阶段判定。

## 4. 适配计划归一化结果

归一化成功：

```json
{
  "planNormalized": true,
  "normalizedPlanState": "sanitized_preview_ready",
  "blockersBefore": [
    "COMMAND_CARRIER_DECLARED",
    "CORRELATION_FIELD_DECLARED"
  ],
  "blockersAfter": [],
  "legacyBlockersCleared": [
    "COMMAND_CARRIER_DECLARED",
    "CORRELATION_FIELD_DECLARED"
  ]
}
```

最终适配计划：

```json
{
  "state": "sanitized_preview_ready",
  "adapterKind": "readonly_unix_socket_ping_adapter",
  "adapterImplementationAllowed": true,
  "adapterInvocationEnabled": false,
  "blockers": [],
  "permittedOperations": [
    "build_sanitized_ping_preview"
  ]
}
```

命令载体和 correlation 两项证据均已写入 `requiredEvidence` 并标记满足。

## 5. 脱敏请求与响应预览

请求：

```text
<TOKEN_REDACTED>\n
sbh-ping-preview-<timestamp>-<random>\n
PING\n
```

响应：

```text
PONG\n
<same correlation candidate>\n
```

真机每次运行都会生成新的 correlation candidate，响应预览第二行与请求第二行一致。

## 6. 安全边界验证

两次运行均满足：

```json
{
  "previewOnly": true,
  "commandAllowlist": ["PING"],
  "commandLockedToPing": true,
  "tokenValueRead": false,
  "tokenValueExposed": false,
  "socketNameValueRead": false,
  "socketNameValueExposed": false,
  "requestConstructedInMemory": true,
  "requestSerialized": false,
  "requestSent": false,
  "responseRead": false,
  "socketConnectionAttempted": false,
  "methodInvocationPerformed": false,
  "runtimeFilesModified": false,
  "authenticationValueUsed": false,
  "adapterInvocationEnabled": false,
  "readyForExplicitDryRun": false,
  "explicitSocketAuthorizationRequired": true,
  "realSocketDryRunAllowed": false,
  "writeOperationsLocked": true,
  "destructiveOperations": false,
  "error": null
}
```

## 7. 遗留展示字段

`app.runtimeProtocolAdapterPlan` 和 `runtimeProtocolAdapterPlanDetails.state` 已正确显示为 `sanitized_preview_ready`。

但 `runtimeWriteGateDetails.protocolAdapterPlanState` 仍保留旧值 `adapter_contract_incomplete`。该字段只是第 18 模块生成的旧摘要标量，内部 `protocolAdapterPlan.state` 已正确归一化，不影响当前安全门禁。下一阶段应在实现真实只读适配器时统一覆盖该旧摘要字段，避免 UI 读取到陈旧状态。

## 8. 阶段结论

```json
{
  "sanitizedPreviewReady": true,
  "planNormalized": true,
  "legacyBlockersCleared": true,
  "singleRunVerificationSucceeded": true,
  "cachedStartupApproximatelyOneSecond": true,
  "realSocketDryRunAllowed": false
}
```

第 26 阶段通过。

## 9. 下一阶段门禁

下一阶段可以合并实现以下内容，但必须取得明确授权后才能执行真实 Socket：

1. 修正 `runtimeWriteGateDetails.protocolAdapterPlanState` 旧摘要字段；
2. 实现只允许 `PING` 的最小自定义 LocalSocket 客户端；
3. 仅读取 endpoint 中的 `socketName` 和 token 用于本次内存请求，不记录、不返回、不写缓存；
4. 使用一次性 correlation；
5. 设置连接、读取和总执行超时；
6. 只接受 `PONG + correlation echo`；
7. 始终禁止 START、STOP_CORE、STOP_RUNTIME 和任何未知命令；
8. 不调用 `CoreClientMain.main()`，不创建成功标记文件；
9. 完成后立即关闭 Socket 并清除内存引用；
10. 将真机结果记录到新的阶段文档。

真实 Socket PING 属于实际运行时交互，不能仅凭上传日志自动视为授权。