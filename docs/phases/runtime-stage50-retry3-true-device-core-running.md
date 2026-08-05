# Runtime Stage 50 Retry 3 真机结果：受限 Core 启动通过

## 结论

Stage 50 Retry 3 真机执行通过。当前 sing-box Core 已由受限启动事务启动，并保持精确受控运行。

## 关键结果

- `ok=true`
- `stage=production_stage50_retry3_runtime_core_start_probe`
- `authorizationConsumed=true`
- `automaticRetryAllowed=false`
- `manualOnly=true`
- `preflightPassed=true`
- `stateDirectoryRepairVerified=true`
- `stateDirectoryMode=700`
- `stateDirectoryUid=0`
- `stateDirectoryGid=0`
- `stage49ProductionConfigLineageVerified=true`
- 生产配置 SHA-256：`35ae10caf0bbb70fed6a10bffae2d782a029c0c18cd0823ce124b4fea5d4da09`
- 生产配置字节数：`29785`
- `productionConfigMode=600`
- `productionConfigUid=0`
- `productionConfigGid=0`
- `productionConfigCheckPassed=true`
- `outboundOnlyCandidateLineage=true`

## Core 启动与身份

- `existingMatchingCoreCountBefore=0`
- `dispatchAttempted=true`
- `dispatchCompletionMarkerObserved=true`
- `dispatchExitCode=0`
- `processPid=1085`
- `processPidReturned=true`
- `processAlive=true`
- `processIdentityValidated=true`
- `processOwnerUid=0`
- `processState=S`
- `matchingCoreCountAfter=1`
- `stabilizationSeconds=4`
- `stabilizationPassed=true`
- `coreStartInvoked=true`
- `coreStopInvoked=false`
- `coreRemainsRunning=true`

## 日志与活动记录

- Core 日志相对路径：`logs/core-start-probe-<run-token>.log`
- `coreLogMode=600`
- `coreLogUid=0`
- `coreLogGid=0`
- `coreLogByteCount=212`
- `fatalLogSignalDetected=false`
- `activePidPublished=true`
- `activeMetadataPublished=true`
- 活动 PID 相对路径：`state/core-probe-active.pid`
- 活动元数据相对路径：`state/core-probe-active.json`

## 网络资源边界

- `tunInterfacePresentBefore=false`
- `tunInterfacePresentAfter=false`
- `tunCreated=false`
- IPv4/IPv6 规则 `8800–8815` 前后数量均为 `0`
- IPv4/IPv6 路由表 `20240` 前后数量均为 `0`
- `reservedNetworkResourcesUnchanged=true`
- `routeModified=false`
- `networkTrafficGeneratedByProbe=false`
- `networkConnectivityTestInvoked=false`

## 回滚状态

- `rollbackInvoked=false`
- `rollbackStoppedExactProcess=false`
- `rollbackTermSignalSent=false`
- `rollbackKillSignalSent=false`

本次启动无异常，因此未进入失败回滚路径。

## Shell 结果说明

- `preflightShellCode=158`
- `dispatchShellCode=158`
- `reconcileShellCode=158`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`

三段 Shell 均返回完整业务完成标记，且派发、PID、进程身份、日志与资源门禁均通过，因此 ShortX 传输层的 `158` 不影响通过结论。

## 下一阶段

- `readyForCoreStatusAndExactStopControl=true`
- `nextAuthorizedOperation=runtime_core_status_and_exact_stop_control`

下一阶段只允许：

1. 读取并核验 Stage 50 Retry 3 发布的活动 PID 与元数据；
2. 只读检查进程身份、配置血缘、日志与网络资源；
3. 在独立按钮授权后精确停止该 PID；
4. 必要时仅在再次验证进程身份后发送 `SIGKILL`；
5. 停止后清理活动记录并保留停止审计；
6. 不修改生产配置、staging、TUN、路由、DNS 或防火墙。
