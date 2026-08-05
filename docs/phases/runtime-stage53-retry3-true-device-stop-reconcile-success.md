# Runtime Stage 53 Retry 3 真机结果：控制器持有 Core 停止归一化通过

## 结论

Stage 53 Retry 3 真机执行通过。Runtime 控制服务持有的 sing-box Core PID `8011` 已通过一次认证 `STOP_CORE` 正常停止；Runtime 控制服务 PID `19373` 保持运行，随后 `STATUS` 返回 `STOPPED`，最终 `PING` 返回 `PONG`。

顶部徽标仍显示“Core 运行中”属于入口启动时的旧状态快照，不能覆盖按钮事务返回的最终状态。

## 关键结果

- `ok=true`
- `stage=production_stage53_retry3_runtime_stop_core_controller_owned_process_reconcile`
- `authorizationId=stage53-retry3-runtime-stop-core-controller-owned-process-reconcile-user-authorized-20260805`
- `sourceDiagnosticId=stage53-retry2-runtime-core-state-divergence-readonly-20260805`
- `authorizationConsumed=true`
- `automaticRetryAllowed=false`
- `manualOnly=true`
- `preflightPassed=true`
- `blockingGate=null`
- `preflightCode=0`
- `shellUid=0`
- `productionConfigCheckPassed=true`

## Runtime 与 Core 身份

- Runtime 控制服务 PID：`19373`
- `controlServiceProcessAliveBefore=true`
- `controlServiceOwnerValidated=true`
- `controllerOwnedCandidateCountBefore=1`
- 选定 Core PID：`8011`
- Core PPid：`19373`
- Core uid：`0`
- Core state：`S`
- 参数数量：`6`
- binary 参数索引：`0`
- config 参数索引：`5`
- `selectedCoreControllerOwned=true`

采用的真机身份契约为：

```text
PID != Runtime PID
PPid == Runtime PID
uid == 0
state != Z
argv0 == production sing-box binary
production config exists in argv at index >= 1
```

## 停止闭环

停止前：

- `statusBeforeCommandSent=true`
- `statusBeforeRequestCount=1`
- `statusBeforeResponseStatus=RUNNING`
- `statusBeforeCorrelationMatched=true`
- `runtimeClaimedRunningBefore=true`

停止操作：

- `stopCoreCommandSent=true`
- `stopCoreRequestCount=1`
- `stopCoreResponseStatus=STOPPED`
- `stopCoreCorrelationMatched=true`
- `selectedCoreStopped=true`
- `remainingControllerOwnedCoreCount=0`
- `controlServiceRemainsRunning=true`

停止后：

- `statusAfterCommandSent=true`
- `statusAfterRequestCount=1`
- `statusAfterResponseStatus=STOPPED`
- `statusAfterCorrelationMatched=true`
- `runtimeClaimedStoppedAfter=true`
- `finalPingSent=true`
- `finalPingRequestCount=1`
- `finalPingResponseStatus=PONG`
- `finalPingCorrelationMatched=true`

## 网络与写入边界

- `tunInterfacePresentBefore=false`
- `tunInterfacePresentAfter=false`
- IPv4/IPv6 规则 `8800–8815` 均为 `0`
- IPv4/IPv6 路由表 `20240` 均为 `0`
- `reservedNetworkResourcesUnchanged=true`
- `directProcessSignalSent=false`
- `coreStartInvoked=false`
- `coreStopInvoked=true`
- `runtimeFilesModified=false`
- `configModified=false`
- `stagingModified=false`
- `tunCreated=false`
- `routeModified=false`
- `dnsModified=false`
- `firewallModified=false`
- `networkConnectivityTestInvoked=false`
- `networkTrafficGeneratedByProbe=false`
- `destructiveOperations=false`

## Shell 传输值

- `preflightShellCode=158`
- `afterStopShellCode=158`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`

业务完成 marker、Runtime 响应、进程消失、控制服务存活和资源边界均完整，因此传输层 `158` 不影响通过结论。

## 下一阶段

- `readyForLifecycleRetry=true`
- `nextAuthorizedOperation=retry_runtime_core_lifecycle_with_controller_owned_process_contract`

下一阶段重新执行完整 `STATUS -> START -> 控制器持有 Core 精确核验 -> STOP_CORE -> STATUS -> PING` 闭环，并使用本次真机确认的父子关系及参数位置契约。
