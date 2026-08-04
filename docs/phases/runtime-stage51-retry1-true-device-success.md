# Runtime Stage 51 Retry 1 真机结果：失效 Core 记录核对通过

## 结论

Stage 51 Retry 1 真机执行通过。Stage 50 Retry 3 遗留的失效 Core 活动记录已完成精确核对和清理，系统中不存在匹配生产配置的 sing-box Core，预留 TUN、规则和路由资源均为空。

控制服务当前仍未运行，因此下一阶段进入 Runtime 控制服务独立恢复，不在本次核对事务中混合进程启动。

## 关键结果

- `ok=true`
- `stage=production_stage51_retry1_stale_core_state_reconciliation`
- `authorizationId=stage51-retry1-stale-core-state-reconcile-user-authorized-20260804`
- `authorizationConsumed=true`
- `manualOnly=true`
- `automaticRetryAllowed=false`
- `completionMarkerObserved=true`
- `blockingGate=null`
- `reconcileCode=0`

## 失效进程与来源记录

- `staleProcessPid=1085`
- `staleProcessAlive=false`
- `staleProcessIdentityMatched=false`
- `activeMetadataStartedAtSeconds=1785849304`
- `transactionPidRecordCount=1`

`staleProcessIdentityMatched=false` 是预期结果：PID 已不存活，无法再从 `/proc/<pid>/cmdline` 验证进程身份；本阶段通过活动元数据、事务 PID、配置哈希、日志和来源授权 ID 完成记录血缘核对。

## 配置和日志

- 生产配置 SHA-256：`35ae10caf0bbb70fed6a10bffae2d782a029c0c18cd0823ce124b4fea5d4da09`
- `productionConfigByteCount=29785`
- `productionConfigCheckExitCode=0`
- `coreLogByteCount=296`
- `fatalLogSignalDetected=false`
- `configModified=false`
- `stagingModified=false`
- `coreLogModified=false`

## Core 与网络资源

- `matchingCoreCountBefore=0`
- `matchingCoreCountAfter=0`
- `tunInterfaceBefore=false`
- `tunInterfaceAfter=false`
- IPv4/IPv6 规则 `8800–8815` 前后数量均为 `0`
- IPv4/IPv6 路由表 `20240` 前后数量均为 `0`
- `coreStartInvoked=false`
- `coreStopInvoked=false`
- `processSignalSent=false`
- `tunCreated=false`
- `routeModified=false`
- `networkAccessed=false`

## 清理和审计

- `staleActiveRecordsRemoved=true`
- `reconcileAuditCreated=true`
- 审计相对路径：`state/core-probe-last-reconcile.json`

已删除的范围仅限：

- `state/core-probe-active.pid`
- `state/core-probe-active.json`
- 唯一匹配的 `state/core-probes/core-start-*.pid`

生产配置、staging、Core 日志和正式备份均保留。

## 控制服务状态

- `controlEndpointExists=false`
- `controlServicePid=0`
- `controlServiceAlive=false`
- `controlServiceRecoveryRequired=true`
- `readyForControlServiceRecovery=true`
- `readyForProductionLifecycleIntegration=false`
- `nextAuthorizedOperation=runtime_control_service_recovery_before_lifecycle_integration`

## Shell 结果说明

- `shellCode=158`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`

业务完成标记、门禁、清理和审计结果均完整，因此 ShortX 传输层的 `158` 不影响通过结论。

## 下一阶段

Stage 52：Runtime 控制服务恢复。

1. 重新验证本阶段核对审计、生产配置血缘、Core 和预留网络资源；
2. 校验 canonical Runtime endpoint；
3. endpoint 对应服务有效时复用，否则使用双 `setsid` 启动新的 `CoreRuntimeMain`；
4. 原子发布 endpoint；
5. 仅发送一次认证 `PING`；
6. 失败时只回滚本次精确控制服务 PID；
7. 不启动 sing-box Core，不创建 TUN，不修改路由、DNS 或防火墙。
