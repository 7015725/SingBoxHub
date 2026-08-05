# Runtime 只读适配阶段 27 重试 3：Shell 内建解析与一次性真实 PING

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.24`
- 入口最低版本：`24`
- 模块数量：`27`
- 修改模块：`src/sbh_27_runtime_readonly_socket_ping.js`
- 模块内部版本：`runtimeReadonlySocketPing = 4`
- 模块 SHA-256：`e0c3169baa0c7f582934e385e04ebae440fdfa51548132549c446a4633a0ee25`
- 授权标识：`stage27-retry3-user-authorized-20260802`
- 状态：实现完成，真机一次性验证待执行

## 1. 输入依据

用户提供《ShortX JS 任务中调用 Shell 命令》作为当前设备的调用基线：

```javascript
var ShellCommand = Packages.tornaco.apps.shortx.core.proto.action.ShellCommand;
var action = ShellCommand.newBuilder()
    .setCommand(command)
    .setSingleShot(true)
    .setId("JS#ShellCommand")
    .build();
var result = shortx.executeAction(action);
var data = result.contextData;
```

返回字段固定为：

```text
shellOut
shellErr
shellCode
```

本模块按该契约实现，不使用 Termux 环境，不调用 `su` 命令，Shell 实际身份由 ShortX Shell 动作提供。

## 2. 根因修复

重试 2 使用 `$TOYBOX awk` 提取 `/proc/<pid>/status` 中的 UID/GID，在当前设备返回空值并触发：

```text
RUNTIME_PROCESS_UID_INVALID
```

重试 3 完全删除 awk，改用 Android `/system/bin/sh` 内建语法：

```sh
while read KEY A B C D REST; do
    case "$KEY" in
        Uid:)
            UR="$A"; UE="$B"; US="$C"; UF="$D"
            ;;
        Gid:)
            GR="$A"; GE="$B"; GS="$C"; GF="$D"
            ;;
    esac
done < "/proc/$PID/status"
```

解析结果包含 real、effective、saved 和 fs UID/GID。

## 3. PID 复用防护

在提取 token 前，模块读取 `/proc/<pid>/cmdline`，仅在命令行包含 endpoint 声明的以下任一值时继续：

```text
serverClass
runtimeJar
```

输出只记录：

```text
runtimeCommandIdentityValidated
runtimeCommandIdentityBasis = serverClass | runtimeJar | none
```

不输出 cmdline 原文。

## 4. Endpoint 身份稳定性

验证顺序：

1. canonical path；
2. `mode=600`；
3. 大小与 schema；
4. `runtimePid`；
5. `/proc/<pid>/status` UID/GID；
6. `/proc/<pid>/cmdline` 身份；
7. 第二次 stat endpoint；
8. endpoint UID/GID 与进程 effective/fs UID/GID 匹配；
9. 全部通过后才提取 socketName/token。

非敏感诊断新增：

```text
endpointProbeShellExitCode
endpointProbeShellErrorPresent
processIdentityShellExitCode
processIdentityShellErrorPresent
processIdentityParseMethod
runtimeCommandIdentityChecked
runtimeCommandIdentityValidated
runtimeCommandIdentityBasis
```

不保存原始 stderr、stdout、endpoint JSON、Base64、token、socketName、cmdline 或 correlation。

## 5. 一次性协议

唯一允许请求：

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

## 6. 缓存隔离

```text
schemaVersion = 4
authorizationId = stage27-retry3-user-authorized-20260802
```

重试 2 的失败缓存不会被复用。重试 3 一旦消费授权，无论成功或失败，后续运行只返回脱敏缓存，不会自动执行第二次 Socket 请求。

## 7. 安全边界

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

## 8. 真机目标

```json
{
  "entryVersion": 24,
  "moduleSetVersion": "20260802.24",
  "runtimeReadonlySocketPing": "readonly_socket_ping_verified",
  "runtimeProtocolAdapterPlan": "readonly_ping_verified",
  "runtimeReadonlySocketPingDetails": {
    "schemaVersion": 4,
    "authorizationConsumed": true,
    "processIdentityParseMethod": "android_sh_builtin_read_case",
    "processIdentityShellExitCode": 0,
    "runtimeProcessIdentityChecked": true,
    "runtimeProcessExists": true,
    "runtimeProcessIdentityValidated": true,
    "runtimeCommandIdentityChecked": true,
    "runtimeCommandIdentityValidated": true,
    "endpointIdentityStable": true,
    "endpointOwnerValidated": true,
    "endpointContractReady": true,
    "tokenValueRead": true,
    "tokenValueExposed": false,
    "socketNameValueRead": true,
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

第二次运行必须满足：

```json
{
  "reusedCachedResult": true,
  "automaticExecution": false,
  "source": "persisted_one_shot_result"
}
```

## 9. 下一阶段门禁

只有真实 PING 成功，并确认第二次运行只复用缓存，才允许进入稳定只读 Runtime 状态适配层。生命周期命令、TUN、路由和配置写入仍保持关闭。