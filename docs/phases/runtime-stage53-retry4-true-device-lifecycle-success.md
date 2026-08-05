# Runtime Stage 53 Retry 4 真机结果：控制器持有 Core 启停闭环通过

## 结论

Stage 53 Retry 4 真机执行通过。已使用真机确认的控制器持有 Core 身份契约，完成完整的 `STATUS -> START -> 精确核验 -> STOP_CORE -> STATUS -> PING` 闭环。

最终状态为：sing-box Core 已停止，Runtime 控制服务继续运行，TUN、规则、路由、DNS 和防火墙均未修改。

## 关键结果

- `ok=true`
- `stage=production_stage53_retry4_runtime_core_lifecycle_controller_owned`
- `authorizationId=stage53-retry4-runtime-core-lifecycle-controller-owned-user-authorized-20260805`
- `sourceStopReconcileAuthorizationId=stage53-retry3-runtime-stop-core-controller-owned-process-reconcile-user-authorized-20260805`
- `authorizationConsumed=true`
- `automaticRetryAllowed=false`
- `manualOnly=true`
- `shellQuotingFixed=true`
- `shellUid=0`
- `preflightPassed=true`
- `blockingGate=null`
- `preflightCode=0`
- `productionConfigCheckPassed=true`

## Runtime 控制服务

- Runtime PID：`19373`
- `controlServiceProcessAliveBefore=true`
- `controlServiceOwnerValidated=true`
- `controlServiceRemainsRunning=true`
- `existingControllerOwnedCoreCountBefore=0`

## 停止态门禁

- `statusBeforeCommandSent=true`
- `statusBeforeRequestCount=1`
- `statusBeforeResponseStatus=STOPPED`
- `statusBeforeCorrelationMatched=true`
- `runtimeClaimedStoppedBefore=true`

## Core 启动与身份核验

- `startCommandSent=true`
- `startRequestCount=1`
- `startResponseStatus=STARTED`
- `startCorrelationMatched=true`
- `coreStartInvoked=true`
- Core PID：`21156`
- `coreProcessVisible=true`
- `coreControllerOwnedIdentityValidated=true`
- `coreProcessOwnerUid=0`
- `coreProcessParentPid=19373`
- `coreProcessArgumentCount=6`
- `coreProcessBinaryArgumentIndex=0`
- `coreProcessConfigArgumentIndex=5`
- `coreProcessControllerOwned=true`
- `coreProcessState=S`
- `startStabilizationSeconds=4`
- `startStabilizationPassed=true`

真机身份契约：

```text
PID != Runtime PID
PPid == Runtime PID
uid == 0
state != Z
argv0 == production sing-box binary
binary argument index == 0
production config exists at any later argument index
```

## Core 停止与最终状态

- `stopCommandSent=true`
- `stopRequestCount=1`
- `stopResponseStatus=STOPPED`
- `stopCorrelationMatched=true`
- `coreStopInvoked=true`
- `matchingCoreCountAfter=0`
- `finalCoreState=stopped`
- `statusAfterCommandSent=true`
- `statusAfterRequestCount=1`
- `statusAfterResponseStatus=STOPPED`
- `statusAfterCorrelationMatched=true`
- `runtimeClaimedStoppedAfter=true`
- `finalPingSent=true`
- `finalPingResponseStatus=PONG`
- `finalPingCorrelationMatched=true`

## 生命周期审计

- `lifecycleAuditCreated=true`
- 相对路径：`state/core-lifecycle-integration-last.json`
- `lifecycleAuditByteCount=443`
- `runtimeFilesModified=true`

写入范围仅包含生命周期审计及 Runtime 既有运行日志；生产配置与 staging 未修改。

## 网络与回滚边界

- `tunInterfacePresentBefore=false`
- `tunInterfacePresentDuring=false`
- `tunInterfacePresentAfter=false`
- IPv4/IPv6 规则 `8800–8815` 均为 `0`
- IPv4/IPv6 路由表 `20240` 均为 `0`
- `reservedNetworkResourcesUnchanged=true`
- `rollbackInvoked=false`
- `rollbackStoppedExactProcess=false`
- `rollbackTermSignalSent=false`
- `rollbackKillSignalSent=false`
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
- `startedObservationShellCode=158`
- `stoppedObservationShellCode=158`
- `auditShellCode=158`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`

业务完成 marker、Runtime 响应、精确进程身份、最终停止状态、审计和网络资源门禁均完整，因此 ShortX 传输层 `158` 不影响通过结论。

## 下一阶段

- `controllerOwnedProcessContractVerified=true`
- `readyForProductionLifecycleUi=true`
- `nextAuthorizedOperation=runtime_production_lifecycle_ui_promotion`

下一阶段将该已验证契约提升到生产 UI，提供串行化的状态、启动和停止控制；提升门禁本身不自动启动或停止 Core。
