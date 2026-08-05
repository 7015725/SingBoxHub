# Runtime Stage 52 真机结果：endpoint marker 冲突导致误回滚

## 结论

Stage 52 前置门禁、控制服务派发、endpoint 发布和恢复审计均已执行，但 JavaScript 汇总层误读了重复的 `EP_DATA` marker，最终返回：

- `ok=false`
- `errorCode=CONTROL_SERVICE_ENDPOINT_DATA_MISSING`
- `nextAuthorizedOperation=resolve_control_service_recovery_gate`

本次不是 Runtime JAR、生产配置、进程派发或 endpoint 文件写入失败，而是多阶段 Shell 输出拼接后的 marker 解析错误。

## 真机关键结果

- `preflightPassed=true`
- `blockingGate=none`
- `preflightCode=0`
- `staleCoreReconcileAuditVerified=true`
- `productionConfigCheckPassed=true`
- `matchingCoreCountBefore=0`
- `tunInterfacePresentBefore=false`
- IPv4/IPv6 规则 `8800–8815` 均为 `0`
- IPv4/IPv6 路由表 `20240` 均为 `0`
- `endpointExistedBefore=true`
- `staleEndpointDetected=true`
- `existingControlServiceReused=false`
- `orphanControlServiceCandidateCount=0`
- `dispatchAttempted=true`
- `dispatchCompletionMarkerObserved=true`
- `dispatchExitCode=0`
- 新控制服务 PID：`11777`
- `endpointModeValidated=true`
- `endpointOwnerValidated=true`
- `endpointByteCount=639`
- `recoveryAuditCreated=true`

以上结果说明新控制服务已经完成派发，并进入 endpoint 与恢复审计发布阶段。

## 根因

Stage 52 前置 Shell 在 stale endpoint 不可复用时输出：

```text
__SBH_EP_DATA__=none
```

新控制服务完成发布后，reconcile Shell 又输出真正的 endpoint Base64：

```text
__SBH_EP_DATA__=<base64 endpoint>
```

原实现将两个阶段输出拼接为同一个 `raw` 字符串：

```javascript
raw = preflight.output;
raw += "\n" + reconcile.output;
endpointData = marker(raw, "EP_DATA");
```

旧 `marker()` 使用首次正则匹配，因此返回前置阶段的 `none`，没有读取后面 reconcile 阶段的真实 endpoint 数据。随后触发：

```text
CONTROL_SERVICE_ENDPOINT_DATA_MISSING
```

## 回滚状态

- `rollbackInvoked=true`
- `rollbackStoppedExactProcess=true`
- `controlServiceRemainsRunning=false`
- `coreStartInvoked=false`
- `coreStopInvoked=false`
- `coreRunning=false`
- `tunCreated=false`
- `routeModified=false`
- `networkTrafficGeneratedByProbe=false`
- `networkAccessed=false`

失败处理只针对本次精确 PID `11777`，没有启动 sing-box Core，也没有修改 TUN、路由、DNS 或防火墙。

## Shell 传输值

- `preflightShellCode=158`
- `dispatchShellCode=158`
- `reconcileShellCode=158`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`

业务完成 marker 和派发结果均完整，根因与 ShortX 传输层 `158` 无关。

## 下一阶段

Stage 52 Retry 1：

1. marker 从输出末尾向前解析，重复名称时采用最后一个值；
2. 前置、派发和 reconcile 输出分别保存；
3. 复用服务时只从 preflight 读取 endpoint；
4. 新启动服务时只从 reconcile 读取 endpoint；
5. 使用新的单次授权重新恢复控制服务；
6. 继续保持 Core、TUN、路由和连通性测试禁用。
