# Runtime 只读适配阶段 26：脱敏 dry-run 预览与适配计划归一化

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.20`
- 入口最低版本：`23`
- 新增模块：`src/sbh_26_runtime_sanitized_dry_run_preview.js`
- 模块 SHA-256：`6db4aa28dab493804048c107ae3cb57ef20f4170a16d74c5a818fdbe4106e530`
- 状态：实现完成，真机验证待执行

## 1. 阶段目标

第 25 阶段已经确认只读 PING 单事务静态契约，但旧适配计划仍保留 `COMMAND_CARRIER_DECLARED` 和 `CORRELATION_FIELD_DECLARED` 两项历史阻断。本阶段一次性完成：

1. 将第 25 阶段证据正式回写适配计划；
2. 清除旧阻断项并重算 `requiredEvidence`、`satisfiedEvidence` 和 `blockers`；
3. 生成不读取 token 原值的三行请求预览；
4. 生成 `PONG + correlation echo` 的两行响应预览；
5. 固定命令只允许 `PING`；
6. 保持真实 Socket、认证值读取和报文发送全部禁用。

## 2. 节约步骤设计

本模块不再读取 JAR、不执行 Shell、不重新分析 DEX，只消费第 25 阶段持久缓存。`runtime.status()` 和 `SBH.app.start()` 会同步完成归一化和预览构造，因此在第 25 阶段缓存有效时，升级入口后的第一次执行就应直接返回最终结果，不再要求等待后运行第二次。

## 3. 脱敏请求预览

```text
<SOCKET_NAME_REDACTED>

<TOKEN_REDACTED>\n
sbh-ping-preview-<timestamp>-<random>\n
PING\n
```

模块不会读取 `endpoint.socketName` 或 `endpoint.token` 的实际值。预览仅记录来源路径和脱敏占位符。

预期响应：

```text
PONG\n
<same correlation candidate>\n
```

## 4. 适配计划归一化

以下证据改为满足：

```text
COMMAND_CARRIER_DECLARED
  runtimeTransactionContract.commandCarrierConfirmed
  request.line[2]
  command:PING

CORRELATION_FIELD_DECLARED
  runtimeTransactionContract.correlationEchoConfirmed
  request.line[1]
  response.line[1]
```

归一化后的计划状态：

```text
state = sanitized_preview_ready
adapterKind = readonly_unix_socket_ping_adapter
blockers = []
permittedOperations = [build_sanitized_ping_preview]
```

真实调用仍被禁止。

## 5. 安全边界

```json
{
  "previewOnly": true,
  "tokenValueRead": false,
  "tokenValueExposed": false,
  "socketNameValueRead": false,
  "socketNameValueExposed": false,
  "requestSerialized": false,
  "requestSent": false,
  "responseRead": false,
  "socketConnectionAttempted": false,
  "methodInvocationPerformed": false,
  "runtimeFilesModified": false,
  "adapterInvocationEnabled": false,
  "readyForExplicitDryRun": false,
  "explicitSocketAuthorizationRequired": true,
  "realSocketDryRunAllowed": false,
  "writeOperationsLocked": true,
  "destructiveOperations": false
}
```

## 6. 真机验证

目标为首次执行直接返回：

```json
{
  "entryVersion": 23,
  "moduleSetVersion": "20260802.20",
  "sync.updated": true,
  "sync.downloadedCount": 26,
  "runtimeSanitizedDryRunPreview": "sanitized_dry_run_preview_ready",
  "runtimeProtocolAdapterPlan": "sanitized_preview_ready"
}
```

重点字段：

```text
runtimeSanitizedDryRunPreviewDetails.planNormalized
runtimeSanitizedDryRunPreviewDetails.blockersBefore
runtimeSanitizedDryRunPreviewDetails.blockersAfter
runtimeSanitizedDryRunPreviewDetails.legacyBlockersCleared
runtimeSanitizedDryRunPreviewDetails.requestPreview
runtimeSanitizedDryRunPreviewDetails.expectedResponsePreview
runtimeSanitizedDryRunPreviewDetails.tokenValueRead
runtimeSanitizedDryRunPreviewDetails.requestSent
runtimeSanitizedDryRunPreviewDetails.socketConnectionAttempted
runtimeSanitizedDryRunPreviewDetails.realSocketDryRunAllowed
runtimeProtocolAdapterPlanDetails.requiredEvidence
runtimeProtocolAdapterPlanDetails.blockers
runtimeProtocolAdapterPlanDetails.permittedOperations
runtimeProtocolAdapterPlanDetails.prohibitedOperations
```

## 7. 下一阶段门禁

只有本阶段真机结果同时满足以下条件，才允许讨论真实只读 Socket dry-run：

```json
{
  "state": "sanitized_dry_run_preview_ready",
  "planNormalized": true,
  "blockersAfter": [],
  "tokenValueRead": false,
  "requestSent": false,
  "socketConnectionAttempted": false,
  "realSocketDryRunAllowed": false,
  "error": null
}
```

真实 Socket dry-run 必须作为独立阶段，并取得明确授权；不得与本阶段自动合并执行。
