# Runtime 阶段 28 重试 1：真机输出不完整

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubRuntimeControlRetry1.js`
- 授权标识：`stage28-retry1-detached-launch-user-authorized-20260803`
- 状态：真机失败，安全停止；进入 Retry 2

## 1. 真机返回

```json
{
  "ok": false,
  "stage": "runtime_stage28_retry1",
  "authorizationConsumed": true,
  "automaticRetryAllowed": false,
  "launcherMode": "direct_no_wait_detached",
  "launcherDetached": false,
  "shellOutputComplete": false,
  "staleEndpointDetected": true,
  "existingServiceCount": 0,
  "existingServiceReused": false,
  "orphanServiceDetected": false,
  "startupRollbackAttempted": false,
  "controlServiceStarted": false,
  "controlServiceProcessAlive": false,
  "endpointContractReady": false,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "shellExitCode": 0,
  "shellErrorPresent": false,
  "errorCode": "CONTROL_SERVICE_START_OUTPUT_INCOMPLETE",
  "durationMs": 15137
}
```

## 2. 已确认事实

1. Root Shell 前置检查成功，`shellExitCode=0` 且 stderr 为空。
2. 旧 endpoint 存在，因此 `staleEndpointDetected=true`。
3. 启动前未发现匹配的 Runtime 控制服务，`existingServiceCount=0`。
4. 返回发生在约 15 秒，与独立入口外层 `toybox timeout 15` 基本一致。
5. Shell 只返回启动命令之前的字段；`launcher_detached`、PID、ready、endpoint 和最终 `result=READY` 均未返回。
6. 无法仅凭当前返回断言 `app_process` 从未短暂启动，但未得到任何可复用的进程或 endpoint 契约证据。

## 3. 根因判断

Retry 1 删除了首版的显式 `wait`，但仍使用：

```sh
nohup app_process ... &
```

在当前 ShortX ShellCommand / Android Shell 执行链中，`nohup` 只处理挂断信号和标准流，不保证长驻子进程脱离原会话、进程组或 ShortX 动作的执行跟踪。真机结果说明 ShellCommand 仍未在预算内得到终态输出。

因此失败点不是已确认的 Runtime 类加载、权限、endpoint schema 或 LocalSocket 协议错误，而是启动器与长驻子进程的分离方式仍不足。

## 4. 安全边界结果

本轮确认未越过以下边界：

```json
{
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "tokenValueRead": false,
  "tokenValueExposed": false,
  "destructiveOperations": false
}
```

未执行自动重试。

## 5. Retry 2 修复方向

Retry 2 使用两段式事务：

1. 启动阶段改为 `toybox setsid app_process ... &`，让控制服务进入新会话；
2. 无论启动阶段输出是否完整，随后执行第二次短时、只读 Shell 复核；
3. 复核只依据 `/proc`、canonical endpoint、mode、PID、cmdline 和 UID/GID 判断服务是否真实可用；
4. 只有复核得到唯一服务且 endpoint 完整绑定后，才读取内存中的 token/socketName 并发送一次 `PING`；
5. 不因第一次 Shell 输出不完整而再次盲目启动，从而避免重复控制服务。

## 6. 下一门禁

只有 Retry 2 同时满足以下条件，Stage 28 才可通过：

```text
reconciliationOutputComplete=true
controlServiceProcessAlive=true
controlServiceCommandValidated=true
controlServiceOwnerValidated=true
endpointFileCanonical=true
endpointModeValidated=true
endpointSchemaValidated=true
endpointContractReady=true
requestCount=1
responseStatus=PONG
correlationMatched=true
```

在此之前，`START`、`STOP_CORE`、`STOP_RUNTIME`、TUN、路由和配置写入继续保持关闭。