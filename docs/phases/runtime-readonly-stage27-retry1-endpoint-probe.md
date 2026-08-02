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
- 状态：真机验证安全失败；endpoint probe 成功；所有者校验失败；未读取 token、未连接 Socket、未发送 PING

## 1. 新授权

首轮真实 PING 尝试在读取 endpoint 阶段安全失败，授权已经消费，但没有读取 token、没有建立 Socket、没有发送请求。

用户随后回复“继续”，本阶段将该回复视为仅针对修复版一次性只读 `PING` 的新授权。

授权范围只有：

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

## 2. 首轮失败与重试 1 修复

首版直接通过 Java 文件流读取 Runtime endpoint，底层读取或解析异常被 `readJson()` 转换为 `null`，最终误报为：

```text
ENDPOINT_SCHEMA_INVALID
```

重试 1 改为复用：

```text
SBH.runtime.endpointProbe()
```

必要时调用一次既有 `runtime.refresh()`，由 Runtime Client 执行：

```text
root Shell 只读状态检查
→ endpoint canonical path / uid / gid / mode / size / mtime
→ endpoint Base64 bytes
→ 内存返回
```

第 27 模块只在内存中 Base64 解码、解析 JSON、校验 endpoint，并计划执行一次真实只读 `PING`。没有读取或执行 Runtime JAR。

## 3. 重试 1 的校验契约

首版重试要求：

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

输出和缓存禁止包含 endpoint 原始 JSON、Base64、socketName、token 或 correlation。

## 4. 一次性请求契约

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

## 5. 真机验证结果

入口和模块更新正常：

```json
{
  "entryVersion": 24,
  "moduleSetVersion": "20260802.22",
  "sync.updated": true,
  "sync.downloadedCount": 27,
  "sync.warning": null
}
```

第 27 模块最终返回：

```json
{
  "schemaVersion": 2,
  "state": "readonly_socket_ping_failed",
  "authorizationId": "stage27-retry1-user-authorized-20260802",
  "authorizationConsumed": true,
  "automaticRetryAllowed": false,
  "endpointProbeAvailable": true,
  "endpointProbeRefreshed": true,
  "endpointProbeTransport": "shortx_root_shell_base64_memory",
  "endpointFileExists": true,
  "endpointContractReady": false,
  "endpointOwnerValidated": false,
  "endpointModeValidated": false,
  "endpointSchemaValidated": false,
  "endpointRefreshElapsedMs": 19021,
  "totalElapsedMs": 19022,
  "errorCode": "ENDPOINT_OWNER_INVALID",
  "error": "Error: ENDPOINT_OWNER_INVALID"
}
```

安全结果：

```json
{
  "tokenValueRead": false,
  "tokenValueUsed": false,
  "tokenValueExposed": false,
  "socketNameValueRead": false,
  "socketNameValueUsed": false,
  "socketNameValueExposed": false,
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

## 6. 结果判定

本次不是 Socket 连接失败、Runtime 认证失败或协议响应失败。执行在 endpoint 元数据校验阶段终止，真实请求路径没有开始。

已经确认：

1. endpoint probe 可用；
2. probe 刷新完成；
3. endpoint 文件存在；
4. Base64 内存读取通道可用；
5. 失败点从不明确的 schema 错误收敛为 `ENDPOINT_OWNER_INVALID`。

当前结果未输出 probe 实际 UID/GID，因此不能据此断言 endpoint 由 root、system 或其他身份创建。只可以确认硬编码的 `uid=1000 && gid=1000` 条件没有通过。

`endpointFileCanonical=false`、`endpointModeValidated=false` 和 `endpointSchemaValidated=false` 是尚未完成后续赋值的默认状态，不能单独解释为路径、权限或 schema 也不匹配。

## 7. 耗时结论

```text
endpointRefreshElapsedMs = 19021
totalElapsedMs = 19022
```

约 19 秒全部发生在 endpoint probe 刷新阶段；没有发生 1500 ms Socket 连接等待，也没有发生 2000 ms 响应读取等待。

顶层应用总耗时约 38 秒还包含模块下载、启动和其他 Runtime 检查，不代表 PING 超时。

## 8. 根因与证据边界

重试 1 的直接阻断原因是把 endpoint 所有者固定假设为：

```text
uid = 1000
gid = 1000
```

当前证据只说明该假设与 probe 结果不一致。更安全的契约不应猜测固定 UID/GID，而应绑定到 endpoint 内声明的 `runtimePid` 对应进程身份。

## 9. 重试 2 修复门禁

下一版必须先完成以下静态和只读修正：

1. 优先消费已经存在且无错误的 endpoint probe，不再无条件执行完整 `runtime.refresh()`；
2. 仅在 probe 缺失、过期或报错时刷新一次；
3. 在脱敏结果中记录实际 endpoint UID、GID、mode，仅记录数字元数据；
4. 解析 endpoint 的 `runtimePid` 后，通过只读 root Shell 获取 `/proc/<runtimePid>/status` 或等价进程身份元数据；
5. 要求 endpoint 文件 UID/GID 与 Runtime 进程有效 UID/GID 匹配，而不是固定为 1000/1000；
6. 保持 canonical path、mode 600、文件大小、schema、socketName 和 token 格式校验；
7. 进程不存在、PID 不匹配、文件所有者与 Runtime 进程不一致时必须停止；
8. 不输出 endpoint 原文、token、socketName、correlation 或 Base64；
9. 仍只允许一次 `PING`，不允许任何生命周期命令；
10. 无论成功或失败都禁止自动重试。

修复后模块数量仍可保持 27，入口仍可保持 v24，模块集升级到下一版本。

## 10. 授权状态

本次授权已经消费：

```json
{
  "authorizationConsumed": true,
  "automaticRetryAllowed": false
}
```

继续运行当前入口只应复用脱敏失败缓存，不得再次读取 endpoint 或连接 Socket。

重试 2 涉及再次读取 token 并尝试一次真实 Socket 连接，必须取得新的明确授权。

## 11. 下一阶段门禁

取得新授权并完成 Runtime 进程身份绑定后，目标仍为：

```json
{
  "state": "readonly_socket_ping_verified",
  "endpointContractReady": true,
  "endpointOwnerValidated": true,
  "tokenValueRead": true,
  "tokenValueExposed": false,
  "requestCount": 1,
  "responseStatus": "PONG",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "socketConnected": true,
  "socketClosed": true,
  "runtimeFilesModified": false,
  "destructiveOperations": false,
  "error": null
}
```

即使验证成功，也只允许进入稳定只读状态适配，不开放 START、STOP、TUN 或路由修改。