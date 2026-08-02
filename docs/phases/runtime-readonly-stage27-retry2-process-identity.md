# Runtime 只读适配阶段 27 重试 2：绑定 Runtime 进程身份的真实 PING

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.23`
- 入口最低版本：`24`
- 模块数量：`27`
- 修改模块：`src/sbh_27_runtime_readonly_socket_ping.js`
- 模块内部版本：`runtimeReadonlySocketPing = 3`
- 模块 SHA-256：`4a271446bf26bbc6a7efc2721d55666e97c128f28b647e21617274a73f4e0def`
- 授权标识：`stage27-retry2-user-authorized-20260802`
- 状态：实现完成，真机一次性验证待执行

## 1. 本次授权

重试 1 的授权已在 endpoint 所有者校验失败时消费。用户随后回复“下一步”，本阶段将其视为仅针对身份绑定修复版的一次性只读 `PING` 新授权。

允许：

```text
PING
```

禁止：

```text
START
STOP_CORE
STOP_RUNTIME
未知命令
TUN、路由、配置和 Runtime 文件修改
```

## 2. 根因修复

重试 1 把 endpoint 文件所有者固定为：

```text
uid = 1000
gid = 1000
```

重试 2 删除该固定假设。新的校验顺序为：

1. 优先复用 120 秒内、无错误且包含 Base64 数据的 Runtime Client endpoint probe；
2. probe 缺失、过期或异常时，仅执行 endpoint 专用只读 Shell，不再调用完整 Runtime inventory；
3. 校验 endpoint canonical path、`mode=600`、大小、schema 和 `runtimePid`；
4. 使用 root 只读 Shell读取 `/proc/<runtimePid>/status` 的 UID/GID；
5. 要求 endpoint UID 与进程 effective UID 或 fs UID 匹配；
6. 要求 endpoint GID 与进程 effective GID 或 fs GID 匹配；
7. 第二次 stat endpoint，确认 UID、GID、mode、size、mtime 和 canonical path 在校验期间未变化；
8. 只有全部通过后才提取 socketName/token 并建立一次 LocalSocket。

输出仅记录数字身份元数据和匹配依据，不输出 `/proc` 原文、endpoint 原文、Base64、token、socketName 或 correlation。

## 3. 一次性协议

请求：

```text
<token>\n
<one-shot correlation>\n
PING\n
```

唯一接受响应：

```text
PONG\n
<same correlation>\n
```

限制：

```json
{
  "connectTimeoutMs": 1500,
  "readTimeoutMs": 2000,
  "totalBudgetMs": 15000,
  "requestCountMaximum": 1,
  "automaticRetryAllowed": false
}
```

## 4. 缓存隔离

缓存 schema 升级到 `3`，授权标识升级到：

```text
stage27-retry2-user-authorized-20260802
```

重试 1 的失败缓存不会被复用。重试 2 一旦消费授权，无论成功还是失败，后续运行只复用脱敏结果，不再次读取 token 或连接 Socket。

## 5. 关键失败码

```text
ROOT_SHELL_REQUIRED
ENDPOINT_METADATA_INVALID
ENDPOINT_IDENTITY_CHANGED
ENDPOINT_RUNTIME_OWNER_MISMATCH
RUNTIME_PROCESS_NOT_FOUND
RUNTIME_PROCESS_STATUS_UNAVAILABLE
RUNTIME_PROCESS_UID_INVALID
RUNTIME_PROCESS_GID_INVALID
TOTAL_EXECUTION_BUDGET_EXCEEDED
UNEXPECTED_RESPONSE_STATUS
CORRELATION_ECHO_MISMATCH
```

## 6. 安全边界

始终保持：

```json
{
  "commandAllowlist": ["PING"],
  "automaticRetryAllowed": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "runtimeStopInvoked": false,
  "unknownCommandInvoked": false,
  "coreClientMainInvoked": false,
  "markerFileCreated": false,
  "runtimeFilesModified": false,
  "tokenValueExposed": false,
  "socketNameValueExposed": false,
  "correlationExposed": false,
  "writeOperationsLocked": true,
  "destructiveOperations": false
}
```

## 7. 真机目标

继续使用 v24 入口。首次运行应只下载变更后的第 27 模块，并消费一次新授权。

成功目标：

```json
{
  "entryVersion": 24,
  "moduleSetVersion": "20260802.23",
  "runtimeReadonlySocketPing": "readonly_socket_ping_verified",
  "runtimeProtocolAdapterPlan": "readonly_ping_verified",
  "runtimeReadonlySocketPingDetails": {
    "schemaVersion": 3,
    "authorizationConsumed": true,
    "endpointFileCanonical": true,
    "endpointModeValidated": true,
    "endpointSchemaValidated": true,
    "endpointIdentityStable": true,
    "runtimeProcessIdentityChecked": true,
    "runtimeProcessExists": true,
    "runtimeProcessIdentityValidated": true,
    "endpointOwnerValidated": true,
    "endpointContractReady": true,
    "tokenValueRead": true,
    "tokenValueExposed": false,
    "requestSent": true,
    "requestCount": 1,
    "responseStatus": "PONG",
    "responseStatusMatched": true,
    "correlationMatched": true,
    "socketConnected": true,
    "socketClosed": true,
    "runtimeFilesModified": false,
    "destructiveOperations": false,
    "errorCode": null,
    "error": null
  }
}
```

第二次运行必须返回：

```json
{
  "reusedCachedResult": true,
  "automaticExecution": false,
  "source": "persisted_one_shot_result"
}
```

且不得建立第二次 Socket 连接。

## 8. 下一阶段门禁

只有本次真实 `PING` 成功并且第二次运行确认缓存复用，才允许进入稳定只读状态适配层。生命周期控制命令仍保持关闭。