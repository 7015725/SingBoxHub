# Runtime 只读适配阶段 27 重试 1：复用 endpoint probe 的真实 PING

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.22`
- 入口最低版本：`24`
- 模块数量：`27`
- 修改模块：`src/sbh_27_runtime_readonly_socket_ping.js`
- 模块内部版本：`runtimeReadonlySocketPing = 2`
- 模块 SHA-256：`9a5efebeadb48a4bcf7491fc03b24ef1ace9d2fd848ae9d536fa3bc0f55c0119`
- 授权标识：`stage27-retry1-user-authorized-20260802`
- 状态：修复实现完成，真机验证待执行

## 1. 新授权

首轮真实 PING 尝试在读取 endpoint 阶段安全失败，授权已经消费，但没有读取 token、没有建立 Socket、没有发送请求。

在明确说明必须取得新授权后，用户回复“继续”。本阶段将该回复视为仅针对修复版一次性只读 `PING` 的新授权。

授权范围仍只有：

```text
PING
```

不授权：

```text
START
STOP_CORE
STOP_RUNTIME
未知命令
TUN 创建
路由修改
配置修改
```

## 2. 首轮失败根因

首版使用：

```javascript
SBH.files.readJson(endpointFile, null)
```

直接通过 Java 文件流读取 Runtime endpoint。底层读取或解析异常被 `readJson()` 吞掉并返回 `null`，最终被误报为：

```text
ENDPOINT_SCHEMA_INVALID
```

前置协议发现已使用 root Shell + Base64 内存通道成功解析同一 endpoint，因此 endpoint 本身并不缺少 schema。

## 3. 修复内容

修复版不再直接读取 endpoint 文件内容，改为复用第 14 模块已经验证的：

```text
SBH.runtime.endpointProbe()
```

当当前进程尚无 probe 时，仅调用一次既有 `runtime.refresh()`，由原 Runtime Client 执行：

```text
root Shell 只读状态检查
→ endpoint canonical path / uid / gid / mode / size / mtime
→ endpoint Base64 bytes
→ 内存返回
```

第 27 模块随后在内存中：

1. Base64 解码；
2. 使用 UTF-8 解析 JSON；
3. 校验 endpoint；
4. 提取 socketName 与 token；
5. 执行一次真实只读 `PING`；
6. 立即清除敏感引用。

没有新增独立 Shell 扫描，也不读取或执行 Runtime JAR。

## 4. Endpoint 强校验

必须全部满足：

```text
probe.exists == true
probe.error == null
probe.real == <shortxDir>/SingBoxHub/runtime/control/control_endpoint.json
uid == 1000
gid == 1000
mode == 600
1 <= size <= 65536
schemaVersion == 1
runtimePid 为数字
socketName 长度 1～128，不能包含换行或 NUL
token 长度 16～256，不能包含换行或 NUL
```

输出只保留非敏感身份字段：

```text
schemaVersion
runtimePid
createdAt
size
mtimeEpochSeconds
uid
gid
mode
```

不会输出或缓存 endpoint 原始 JSON、Base64、socketName、token 或 correlation。

## 5. 精确错误码

修复版保留实际失败代码，不再统一降级：

```text
ENDPOINT_PROBE_UNAVAILABLE
ENDPOINT_PROBE_ERROR
ENDPOINT_PROBE_DATA_MISSING
ENDPOINT_FILE_NOT_FOUND
ENDPOINT_CANONICAL_PATH_MISMATCH
ENDPOINT_OWNER_INVALID
ENDPOINT_MODE_INVALID
ENDPOINT_FILE_SIZE_INVALID
ENDPOINT_JSON_PARSE_FAILED
ENDPOINT_SCHEMA_INVALID
ENDPOINT_RUNTIME_PID_INVALID
ENDPOINT_SOCKET_NAME_INVALID
ENDPOINT_TOKEN_INVALID
TOTAL_EXECUTION_BUDGET_EXCEEDED
UNEXPECTED_RESPONSE_STATUS
CORRELATION_ECHO_MISMATCH
READONLY_SOCKET_PING_FAILED
```

错误文本仍会脱敏并限制为 512 字符。

## 6. 一次性请求

请求：

```text
<token>\n
<one-shot correlation>\n
PING\n
```

仅接受：

```text
PONG\n
<same correlation>\n
```

约束：

```json
{
  "connectTimeoutMs": 1500,
  "readTimeoutMs": 2000,
  "totalBudgetMs": 15000,
  "requestCountMaximum": 1,
  "automaticRetryAllowed": false
}
```

总预算包含必要时执行的一次 endpoint probe 刷新。

## 7. 缓存与授权隔离

缓存 schema 从 1 升级到 2，授权标识更新为：

```text
stage27-retry1-user-authorized-20260802
```

首轮失败缓存因 schema 和授权标识不匹配而不会被复用。

修复版一旦实际消费授权，无论成功或失败，后续运行只返回本轮脱敏缓存，不会再次读取 token 或再次连接 Socket。

静态门禁未就绪时不会消费授权。

## 8. 安全边界

始终保持：

```json
{
  "commandAllowlist": ["PING"],
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

## 9. 真机目标

继续使用 v24 入口。首次运行应更新 27 个模块中的变更模块并消费一次新授权。

目标：

```json
{
  "entryVersion": 24,
  "moduleSetVersion": "20260802.22",
  "runtimeReadonlySocketPing": "readonly_socket_ping_verified",
  "runtimeProtocolAdapterPlan": "readonly_ping_verified",
  "runtimeReadonlySocketPingDetails": {
    "authorizationConsumed": true,
    "endpointProbeAvailable": true,
    "endpointContractReady": true,
    "endpointFileCanonical": true,
    "endpointOwnerValidated": true,
    "endpointModeValidated": true,
    "endpointSchemaValidated": true,
    "tokenValueRead": true,
    "tokenValueUsed": true,
    "tokenValueExposed": false,
    "socketNameValueRead": true,
    "socketNameValueExposed": false,
    "requestSent": true,
    "requestCount": 1,
    "responseStatus": "PONG",
    "responseStatusMatched": true,
    "correlationMatched": true,
    "socketConnectionAttempted": true,
    "socketConnected": true,
    "socketClosed": true,
    "sensitiveReferencesCleared": true,
    "runtimeFilesModified": false,
    "destructiveOperations": false,
    "errorCode": null,
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

## 10. 下一阶段门禁

只有真实 PING 验证成功，才允许将该结果接入稳定只读状态层。即使成功，也不开放任何生命周期控制命令。