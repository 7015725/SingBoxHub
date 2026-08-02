# Runtime 只读适配阶段 27 重试 3：真机结果与过期 Endpoint 结论

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.24`
- 入口版本：`24`
- 模块数量：`27`
- 对应实现：`src/sbh_27_runtime_readonly_socket_ping.js`
- 模块内部版本：`runtimeReadonlySocketPing = 4`
- 授权标识：`stage27-retry3-user-authorized-20260802`
- 状态：真机已执行，连接前安全失败

## 1. 阶段目标

删除 `$TOYBOX awk` 依赖，使用 Android `/system/bin/sh` 内建 `read + case` 解析 `/proc/<runtimePid>/status`，绑定 endpoint 与 Runtime 进程身份后，仅执行一次只读 `PING`。

## 2. 输入证据

真机返回：

```json
{
  "moduleSetVersion": "20260802.24",
  "state": "readonly_socket_ping_retry3_failed",
  "errorCode": "RUNTIME_PROCESS_NOT_FOUND",
  "authorizationConsumed": true,
  "automaticRetryAllowed": false
}
```

Endpoint 专用 probe 成功：

```json
{
  "endpointProbeRefreshed": true,
  "endpointProbeShellExitCode": 0,
  "endpointProbeShellErrorPresent": false,
  "endpointFileExists": true,
  "endpointFileCanonical": true,
  "endpointModeValidated": true,
  "endpointSchemaValidated": true,
  "endpointIdentity": {
    "runtimePid": 27363,
    "uid": 0,
    "gid": 0,
    "mode": "600",
    "size": 616,
    "mtimeEpochSeconds": 1785580778
  }
}
```

进程检查结果：

```json
{
  "processIdentityParseMethod": "android_sh_builtin_read_case",
  "processIdentityShellExitCode": 0,
  "processIdentityShellErrorPresent": false,
  "runtimeProcessIdentityChecked": true,
  "runtimeProcessExists": false,
  "runtimeProcessIdentityValidated": false
}
```

## 3. 结论

本轮不再出现 `RUNTIME_PROCESS_UID_INVALID`，说明 Shell 调用契约和内建解析路径已越过上一轮失败点。

当前 endpoint 文件仍声明 `runtimePid=27363`，但 `/proc/27363` 已不存在。因此该文件是遗留的过期 endpoint，不能作为真实 Socket 请求依据。

这不是：

- ShortX Shell 调用失败；
- UID/GID 解析失败；
- endpoint schema 或权限失败；
- LocalSocket 连接失败；
- token 认证失败；
- PING/PONG 协议失败。

## 4. 安全边界

失败发生在读取敏感字段和建立 Socket 之前：

```json
{
  "tokenValueRead": false,
  "socketNameValueRead": false,
  "correlationGenerated": false,
  "requestConstructedInMemory": false,
  "requestSent": false,
  "requestCount": 0,
  "responseRead": false,
  "socketConnectionAttempted": false,
  "socketConnected": false,
  "runtimeFilesModified": false,
  "destructiveOperations": false
}
```

授权已经消费，当前版本不得自动重试。

## 5. 性能

```text
endpointRefreshElapsedMs = 640
processIdentityElapsedMs = 234
totalElapsedMs = 878
```

专用 probe 和进程检查均在 1 秒内完成；顶层约 18 秒主要来自 27 个模块同步和启动流程。

## 6. 下一门禁

不得继续对过期 endpoint 反复执行 PING。

下一阶段必须先建立 Runtime 控制服务存活门禁：

1. 判断 endpoint 中的 PID 是否存在；
2. 若不存在，将 endpoint 标记为 stale；
3. 不读取 token，不建立 Socket；
4. 只有在获得明确授权后，才允许启动或重新附加 Runtime 控制服务并生成新 endpoint；
5. 新 endpoint 必须拥有新的存活 PID、合理 createdAt/mtime，并通过进程身份与命令行校验；
6. 随后才允许再次执行一次只读 PING。

启动 Runtime 控制服务属于状态变更，不能由本阶段授权自动推导。sing-box 核心启动、TUN、路由和配置写入仍保持禁止。