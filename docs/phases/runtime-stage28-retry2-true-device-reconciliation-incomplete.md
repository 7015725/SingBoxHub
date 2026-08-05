# Runtime 阶段 28 重试 2：真机复核输出不完整

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试阶段：`runtime_stage28_retry2`
- 授权标识：`stage28-retry2-setsid-reconcile-user-authorized-20260803`
- 状态：真机失败，安全停止；进入 Retry 3

## 1. 真机关键结果

```json
{
  "ok": false,
  "launcherMode": "toybox_setsid_reconcile",
  "launcherDetached": false,
  "launchShellExitCode": 0,
  "launchShellErrorPresent": false,
  "launchOutputComplete": false,
  "launchResult": null,
  "reconciliationAttempted": true,
  "reconciliationShellExitCode": 0,
  "reconciliationShellErrorPresent": false,
  "reconciliationOutputComplete": false,
  "reconciliationResult": null,
  "staleEndpointDetected": true,
  "existingServiceCount": 0,
  "controlServiceStarted": false,
  "endpointContractReady": false,
  "requestSent": false,
  "requestCount": 0,
  "errorCode": "CONTROL_SERVICE_RECONCILIATION_INCOMPLETE",
  "durationMs": 14357
}
```

## 2. 已确认事实

1. 启动 Shell 和复核 Shell 的 `shellExitCode` 均为 `0`，stderr 均为空。
2. 两次 Shell 均未返回预期的终态字段，`launchResult` 与 `reconciliationResult` 都为 `null`。
3. 总耗时约 14.36 秒，接近启动 8 秒和复核 6 秒预算的组合。
4. 复核阶段没有得到 PID、endpoint、cmdline 或所有者证据，因此不能将服务判定为已启动。
5. 旧 endpoint 仍被识别为过期状态。

## 3. Retry 2 的实现问题

### 3.1 复核仍执行全量 `/proc` 扫描

Retry 2 虽然把启动与复核拆成两次 ShellCommand，但复核仍遍历：

```sh
/proc/[0-9]*
```

并对每个候选进程调用一次外部 `toybox tr` 读取 cmdline。在 Android 系统进程较多时，该方式会消耗复核阶段的短时预算，导致只读复核本身也无法输出终态。

### 3.2 `setsid ... &` 仍受外层 Shell 管理

Retry 2 使用一次 `setsid` 后仍通过 `&` 后台启动。结果证明，在当前 ShortX ShellCommand 执行链中，该组合仍未形成可验证的快速返回启动事务。

### 3.3 结果分类过于宽松

Retry 2 在 `launchResult=null` 时没有立即保留精确的启动输出不完整错误，而是继续进入复核。复核同样超时后，最终只返回 `CONTROL_SERVICE_RECONCILIATION_INCOMPLETE`，降低了诊断粒度。

## 4. 安全边界结果

本轮确认未越过以下边界：

```json
{
  "authorizationConsumed": true,
  "automaticRetryAllowed": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "runtimeFilesModified": false,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "tokenValueRead": false,
  "tokenValueExposed": false,
  "destructiveOperations": false
}
```

未执行自动重试。

## 5. Retry 3 修复门禁

Retry 3 必须同时满足：

1. 不再遍历全部 `/proc`；
2. 只检查 canonical endpoint 中的已知 PID，以及本次事务的精确 PID 文件；
3. 使用双 `setsid` 同步派发，不在启动 Shell 中使用 `&`；
4. 派发阶段只负责得到 `DISPATCHED`，状态确认完全交给独立复核阶段；
5. 新服务失败时，只按本次事务 PID 精确回滚；
6. endpoint、cmdline、UID/GID 和权限全部通过后，最多发送一次只读 `PING`；
7. 任意结果缺失均保留独立错误码，不再把 `null` 当作可接受启动结果。

在 Retry 3 真机通过前，Core 启停、TUN、路由和配置写入继续保持关闭。