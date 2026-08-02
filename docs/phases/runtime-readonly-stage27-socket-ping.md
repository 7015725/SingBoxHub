# Runtime 只读适配阶段 27：一次性真实 LocalSocket PING 验证

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.21`
- 入口最低版本：`24`
- 新增模块：`src/sbh_27_runtime_readonly_socket_ping.js`
- 模块 SHA-256：`06238632ac09d9687d4c500ff35d72002d51754d34fe93ed2e5c9beabb03342a`
- 授权标识：`stage27-user-authorized-20260802`
- 状态：真机验证安全失败；失败发生在 endpoint 读取阶段，未读取 token、未连接 Socket、未发送 PING；修复与重试待新授权

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

真实请求设计：

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

本次真机执行时，上述静态门禁全部通过。

## 5. Endpoint 约束与首版实现

首版第 27 模块通过：

```javascript
endpoint = SBH.files.readJson(file, null);
```

直接读取：

```text
<shortxDir>/SingBoxHub/runtime/control/control_endpoint.json
```

随后校验 schema、runtimePid、socketName 和 token。

`SBH.files.readJson()` 在读取或 JSON 解析异常时会记录警告并返回 fallback，而首版 fallback 为 `null`。因此底层直接文件读取失败会在上层被统一表现为：

```text
ENDPOINT_SCHEMA_INVALID
```

这会丢失真正的文件读取或解析异常类型。

## 6. 真机验证结果

```json
{
  "entryVersion": 24,
  "moduleSetVersion": "20260802.21",
  "runtimeReadonlySocketPing": "readonly_socket_ping_failed",
  "protocolAdapterPlanState": "readonly_ping_verification_failed",
  "authorizationConsumed": true,
  "dryRunInvoked": true,
  "endpointFileExists": true,
  "endpointValueRead": true,
  "endpointContractReady": false,
  "endpointSchemaValidated": false,
  "errorCode": "READONLY_SOCKET_PING_FAILED",
  "error": "Error: ENDPOINT_SCHEMA_INVALID",
  "totalElapsedMs": 1
}
```

关键安全结果：

```json
{
  "tokenValueRead": false,
  "tokenValueUsed": false,
  "socketNameValueRead": false,
  "socketNameValueUsed": false,
  "correlationGenerated": false,
  "requestConstructedInMemory": false,
  "requestSerialized": false,
  "requestSent": false,
  "requestCount": 0,
  "responseRead": false,
  "socketConnectionAttempted": false,
  "socketConnected": false,
  "runtimeFilesModified": false,
  "destructiveOperations": false,
  "sensitiveReferencesCleared": true
}
```

结论：失败发生在 Socket 创建之前，不是 Runtime 拒绝、连接超时、认证失败或协议响应错误。

## 7. 根因定位

前置 `runtimeProtocolDiscovery` 对同一 endpoint 已通过 `runtime.endpointProbe()` 的 root Shell + Base64 内存通道成功解析，并确认：

```json
{
  "parseOk": true,
  "endpointSchemaVersion": "1",
  "authenticationDeclared": true,
  "transportKind": "unix_socket",
  "endpointSize": 616
}
```

因此 Runtime endpoint 本身具备 schemaVersion、socketName 和 token。首版第 27 模块失败的直接原因是：

1. 改用 Java `FileInputStream` 直接读取 Runtime endpoint；
2. `SBH.files.readJson()` 吞掉了底层读取或解析异常并返回 `null`；
3. `validateEndpoint()` 将 `null` 统一映射为 `ENDPOINT_SCHEMA_INVALID`；
4. 实际 Socket 逻辑完全没有执行。

当前日志不能进一步区分直接读取失败属于 SELinux、文件瞬时一致性还是解析异常，因为原始异常已被 `readJson()` 隐藏。

## 8. 修复方案

修复版不得继续使用直接 Java 文件读取，改为复用已验证的 endpoint probe：

```text
SBH.runtime.endpointProbe()
  -> root Shell 只读
  -> canonical path / uid / gid / mode / size / mtime
  -> Base64 endpoint bytes
  -> 内存 JSON.parse
```

要求：

1. 不新增额外 Shell 扫描；复用第 14 模块已生成的 probe；
2. 校验 `probe.exists == true`；
3. 校验 `probe.real` 等于标准 canonical path；
4. 校验 `uid=1000`、`gid=1000`、`mode=600`；
5. 校验 size 为 1～65536；
6. 仅在内存中 Base64 解码和解析；
7. 解析后立即清除原始 JSON、Base64、token 和 socketName 引用；
8. 将具体校验错误码直接写入 `errorCode`，不再统一降级成 `READONLY_SOCKET_PING_FAILED`；
9. 不缓存 endpoint 原始数据和敏感字段；
10. 保持一次授权一次连接、禁止自动重试。

## 9. 授权状态

首版结果已持久化为：

```text
source = persisted_one_shot_result
authorizationConsumed = true
automaticRetryAllowed = false
```

因此再次运行当前 v24 只会复用失败结果，不会重新读取 endpoint 或连接 Socket。

虽然真实 Socket 尚未建立，但首版阶段契约明确规定“一旦实际消费，无论成功或失败均不自动重试”。修复后的第二次尝试必须使用新的授权标识，不能静默复用本次授权。

## 10. 下一阶段门禁

新的明确授权后，允许一次性执行修复版只读 PING。目标结果仍为：

```json
{
  "state": "readonly_socket_ping_verified",
  "endpointContractReady": true,
  "tokenValueRead": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "socketClosed": true,
  "sensitiveReferencesCleared": true,
  "runtimeFilesModified": false,
  "destructiveOperations": false,
  "error": null
}
```

任何生命周期控制命令仍保持禁止。