# Runtime Stage 52 Retry 1 真机结果：控制服务恢复通过

## 结论

Stage 52 Retry 1 真机执行通过。endpoint marker 冲突修复生效，Runtime 控制服务已重新启动，canonical endpoint 已发布并完成一次认证 `PING`。控制服务保持运行，sing-box Core 仍为停止状态。

## 关键结果

- `ok=true`
- `stage=production_stage52_retry1_runtime_control_service_recovery`
- `authorizationId=stage52-retry1-runtime-control-service-recovery-user-authorized-20260805`
- `sourceReconcileAuthorizationId=stage51-retry1-stale-core-state-reconcile-user-authorized-20260804`
- `authorizationConsumed=true`
- `automaticRetryAllowed=false`
- `manualOnly=true`
- `markerResolutionMode=phase_scoped_reverse_line_scan`
- `endpointDataSource=reconcile_published_endpoint`
- `endpointDataObserved=true`
- `preflightPassed=true`
- `blockingGate=null`
- `preflightCode=0`

## 配置与前置资源

- `staleCoreReconcileAuditVerified=true`
- 生产配置 SHA-256：`35ae10caf0bbb70fed6a10bffae2d782a029c0c18cd0823ce124b4fea5d4da09`
- `productionConfigByteCount=29785`
- `productionConfigCheckPassed=true`
- `matchingCoreCountBefore=0`
- `tunInterfacePresentBefore=false`
- IPv4/IPv6 规则 `8800–8815` 均为 `0`
- IPv4/IPv6 路由表 `20240` 均为 `0`
- `endpointExistedBefore=false`
- `staleEndpointDetected=false`
- `existingControlServiceReused=false`
- `orphanControlServiceCandidateCount=0`

## 控制服务派发与身份

- `dispatchAttempted=true`
- `dispatchCompletionMarkerObserved=true`
- `dispatchExitCode=0`
- `controlServiceStarted=true`
- 控制服务 PID：`19373`
- `controlServiceProcessAlive=true`
- `controlServiceCommandValidated=true`
- `controlServiceOwnerValidated=true`
- `controlServiceRemainsRunning=true`

## endpoint 与恢复审计

- `endpointFileCanonical=true`
- `endpointModeValidated=true`
- `endpointOwnerValidated=true`
- `endpointSchemaValidated=true`
- `endpointContractReady=true`
- `endpointByteCount=639`
- `recoveryAuditCreated=true`
- 审计相对路径：`state/control-service-last-recovery.json`

## 一次认证 PING

- `localSocketWrapperCreated=true`
- `localSocketPublicConnectUsed=true`
- `connectTimeoutOverloadUsed=false`
- `socketReadTimeoutConfigured=true`
- `socketConnectionAttempted=true`
- `socketConnected=true`
- `requestSent=true`
- `requestCount=1`
- `responseStatus=PONG`
- `responseStatusMatched=true`
- `correlationMatched=true`
- `socketClosed=true`
- `sensitiveReferencesCleared=true`
- token 与 socketName 均已读取但未暴露

## 回滚与安全边界

- `rollbackInvoked=false`
- `rollbackStoppedExactProcess=false`
- `coreStartInvoked=false`
- `coreStopInvoked=false`
- `coreRunning=false`
- `runtimeFilesModified=true`，范围仅为控制服务 endpoint、恢复审计和运行日志
- `configModified=false`
- `stagingModified=false`
- `tunCreated=false`
- `routeModified=false`
- `networkTrafficGeneratedByProbe=false`
- `networkAccessed=false`
- `destructiveOperations=false`

## Shell 结果说明

- `preflightShellCode=158`
- `dispatchShellCode=158`
- `reconcileShellCode=158`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`

三段 Shell 均返回完整业务完成 marker，派发、endpoint、PING 和身份门禁全部通过，因此 ShortX 传输层 `158` 不影响通过结论。

## 下一阶段

- `controlServiceRecoveryRequired=false`
- `readyForProductionLifecycleIntegration=true`
- `nextAuthorizedOperation=runtime_core_lifecycle_control_integration`

下一阶段通过已认证 Runtime 控制服务执行一次受限 `START -> 精确核验 -> STOP_CORE -> 精确核验 -> PING` 闭环，最终状态必须为 Core 已停止、控制服务仍运行；TUN、路由、DNS、防火墙和节点连通性测试继续禁用。
