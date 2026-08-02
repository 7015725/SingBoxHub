# Runtime 只读适配阶段 27：一次性真实 LocalSocket PING 验证

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.21`
- 入口最低版本：`24`
- 新增模块：`src/sbh_27_runtime_readonly_socket_ping.js`
- 模块 SHA-256：`06238632ac09d9687d4c500ff35d72002d51754d34fe93ed2e5c9beabb03342a`
- 授权标识：`stage27-user-authorized-20260802`
- 状态：实现完成，真机验证待执行

## 1. 授权边界

第 26 阶段完成后，用户被明确告知下一阶段将读取 `endpoint.socketName`、读取 token、建立 Android `LocalSocket` 并发送一次只读 `PING`。用户随后回复“下一阶段”，本阶段将其作为对该单次只读验证的明确授权。

授权只适用于：

```text
PING
```

不授权：

```text
START
STOP_CORE
STOP_RUNTIME
任何未知命令
TUN 创建
路由修改
配置修改
```

## 2. 阶段目标

一次性完成：

1. 修正 `runtimeWriteGateDetails.protocolAdapterPlanState` 陈旧摘要；
2. 从标准 endpoint 文件读取 `socketName` 和 token；
3. 生成一次性 correlation；
4. 连接 Linux abstract namespace 下的 Android `LocalSocket`；
5. 发送严格三行请求；
6. 读取严格两行响应；
7. 验证 `PONG + correlation echo`；
8. 立即关闭流和 Socket；
9. 清除敏感引用；
10. 只缓存脱敏结果，后续运行不得重复连接。

## 3. 请求与响应

真实请求：

```text
<token>\n
<one-shot correlation>\n
PING\n
```

真实响应必须是：

```text
PONG\n
<same correlation>\n
```

模块不调用 `CoreClientMain.main()`，因此不会执行其 `File.createNewFile()` 成功标记副作用。

## 4. 执行前门禁

只有以下状态同时满足才会消费授权：

```json
{
  "runtimeTransactionContract.readOnlyPingContractReady": true,
  "runtimeTransactionContract.pingSideEffectFree": true,
  "runtimeSanitizedDryRunPreview.state": "sanitized_dry_run_preview_ready",
  "runtimeSanitizedDryRunPreview.planNormalized": true,
  "protocolAdapterPlan.state": "sanitized_preview_ready",
  "protocolAdapterPlan.blockers": [],
  "protocolAdapterPlan.adapterInvocationEnabled": false
}
```

静态门禁未就绪时：

```text
state = readonly_socket_ping_waiting_for_gate
authorizationConsumed = false
dryRunInvoked = false
```

这种情况不会连接 Socket，下一次运行仍可继续使用同一授权。

## 5. Endpoint 约束

只接受固定路径：

```text
<shortxDir>/SingBoxHub/runtime/control/control_endpoint.json
```

校验内容：

- 必须是普通文件；
- canonical path 必须完全匹配；
- 文件大小为 1～65536 字节；
- `schemaVersion == 1`；
- `runtimePid` 为数字；
- `socketName` 长度为 1～128，不能包含换行和 NUL；
- token 长度为 16～256，不能包含换行和 NUL。

缓存只记录非敏感 endpoint 身份字段：schema、runtimePid、createdAt、文件大小和修改时间。

## 6. 超时与一次性规则

```json
{
  "connectTimeoutMs": 1500,
  "readTimeoutMs": 2000,
  "totalBudgetMs": 4000,
  "requestCount": 1,
  "automaticRetryAllowed": false
}
```

授权一旦实际消费，无论成功或失败，后续运行都只返回持久化的脱敏结果，不再次读取 token、不再次连接 Socket。需要重试时必须进入新的明确授权阶段。

## 7. 安全输出

允许输出：

- 是否读取和使用 token；
- 是否连接 Socket；
- 是否发送请求；
- 安全响应状态 `PONG`；
- correlation 是否匹配；
- 连接和总耗时；
- 非敏感 endpoint 身份字段；
- 脱敏错误码和脱敏错误文本。

禁止输出或缓存：

- token 原值；
- socketName 原值；
- correlation 原值；
- endpoint 原始 JSON；
- 完整请求报文。

错误文本会替换可能出现的 token 和 socketName，并限制为 512 字符。

## 8. 预期真机结果

首次运行 v24 应完成模块更新并执行一次真实 PING。成功目标：

```json
{
  "entryVersion": 24,
  "moduleSetVersion": "20260802.21",
  "sync.updated": true,
  "sync.downloadedCount": 27,
  "runtimeReadonlySocketPing": "readonly_socket_ping_verified",
  "runtimeProtocolAdapterPlan": "readonly_ping_verified",
  "runtimeReadonlySocketPingDetails": {
    "authorizationConsumed": true,
    "endpointContractReady": true,
    "tokenValueRead": true,
    "tokenValueUsed": true,
    "tokenValueExposed": false,
    "socketNameValueRead": true,
    "socketNameValueExposed": false,
    "correlationGenerated": true,
    "correlationExposed": false,
    "requestSent": true,
    "requestCount": 1,
    "responseRead": true,
    "responseLineCount": 2,
    "responseStatus": "PONG",
    "responseStatusMatched": true,
    "correlationMatched": true,
    "socketConnectionAttempted": true,
    "socketConnected": true,
    "socketClosed": true,
    "sensitiveReferencesCleared": true,
    "coreStartInvoked": false,
    "coreStopInvoked": false,
    "runtimeStopInvoked": false,
    "unknownCommandInvoked": false,
    "coreClientMainInvoked": false,
    "markerFileCreated": false,
    "runtimeFilesModified": false,
    "writeOperationsLocked": true,
    "destructiveOperations": false,
    "error": null
  }
}
```

第二次运行必须显示：

```json
{
  "reusedCachedResult": true,
  "automaticExecution": false,
  "source": "persisted_one_shot_result"
}
```

且不得建立第二次 Socket 连接。

## 9. 失败判定

失败状态：

```text
readonly_socket_ping_failed
```

常见错误码：

```text
ENDPOINT_FILE_NOT_FOUND
ENDPOINT_CANONICAL_PATH_MISMATCH
ENDPOINT_FILE_SIZE_INVALID
ENDPOINT_SCHEMA_INVALID
ENDPOINT_RUNTIME_PID_INVALID
ENDPOINT_SOCKET_NAME_INVALID
ENDPOINT_TOKEN_INVALID
TOTAL_EXECUTION_BUDGET_EXCEEDED
UNEXPECTED_RESPONSE_STATUS
CORRELATION_ECHO_MISMATCH
READONLY_SOCKET_PING_FAILED
```

失败结果也不会自动重试。

## 10. 下一阶段门禁

只有真实结果满足以下条件，才允许将该能力接入稳定的只读状态层：

```json
{
  "state": "readonly_socket_ping_verified",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "socketClosed": true,
  "sensitiveReferencesCleared": true,
  "runtimeFilesModified": false,
  "destructiveOperations": false,
  "error": null
}
```

下一阶段不得自动开放 START、STOP_CORE 或 STOP_RUNTIME。任何生命周期控制必须重新建立独立协议证据、UI 确认和写操作门禁。
