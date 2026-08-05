# Runtime 阶段 30：正式只读状态适配器门禁

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口候选：`entry/SingBoxHubRuntimeReadonlyStatusAdapter.js`
- 下载文件：`SingBoxHub_Runtime只读状态适配器阶段30.txt`
- SHA-256：`23849cddb036cae8db6ee9a334e746dae05ee364972f84d0adc5ee23f042a8e1`
- 阶段：`runtime_stage30_readonly_status_adapter`
- 状态：实现完成，真机验证待执行

## 1. 目标

将 Stage 28 已验证的控制协议收敛为可供 UI 接入的规范化只读状态结果，不再承担控制服务启动职责。

适配器只开放：

```text
runtime.handshake
runtime.status
core.status
```

所有写操作继续锁定。

## 2. 执行流程

```text
读取 canonical endpoint 元数据和 Base64 内容
        ↓
校验路径、0600 权限、大小和 schema
        ↓
按 endpoint runtimePid 校验精确进程
        ↓
校验 cmdline、UID/GID 和 Core 状态
        ↓
建立 Android abstract LocalSocket
        ↓
发送一次 token + correlation + PING
        ↓
校验 PONG + correlation
        ↓
输出 handshake/status 规范对象
```

## 3. 与 Stage 28 的区别

Stage 30：

- 不启动控制服务；
- 不清理孤立服务；
- 不写 endpoint、PID、ready 或日志文件；
- 不轮询；
- 不自动重试；
- 只读取既有 endpoint 和进程状态；
- 只发送一次认证 `PING`。

## 4. 规范化输出

成功时应包含：

```json
{
  "ok": true,
  "adapterReady": true,
  "transport": "android_local_socket_authenticated_ping",
  "runtimeState": "stopped",
  "controlServiceProcessAlive": true,
  "controlServiceCommandValidated": true,
  "controlServiceOwnerValidated": true,
  "endpointContractReady": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "handshake": {
    "ok": true,
    "attached": true,
    "readOnly": true,
    "controlServiceHealthy": true
  },
  "status": {
    "ok": true,
    "attached": true,
    "authenticatedPingVerified": true,
    "writeOperationsLocked": true
  }
}
```

`runtimeState` 会根据 sing-box Core 的真实进程状态返回 `running` 或 `stopped`。

## 5. 安全边界

```json
{
  "pollingEnabled": false,
  "automaticRetryAllowed": false,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "writeOperationsLocked": true,
  "destructiveOperations": false
}
```

输出不包含 token、socketName、correlation 或 endpoint 原文。

## 6. 静态验证

```text
Node.js syntax check: passed
Rhino ES5 forbidden syntax scan: passed
let/const/arrow/class/template literal: absent
LocalSocket timeout overload: absent
setSoTimeout occurs after connect: confirmed
```

## 7. 下一阶段门禁

只有 Stage 30 真机返回：

```text
ok=true
adapterReady=true
requestCount=1
responseStatus=PONG
responseStatusMatched=true
correlationMatched=true
runtimeFilesModified=false
```

才将适配器合并进入常驻 UI 模块集，并替换当前 Shell-only 握手显示。
