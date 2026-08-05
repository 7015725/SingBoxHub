# Runtime Stage 50 Retry 1 真机结果：定位 `state_directory` 阻断门禁

## 结论

Stage 50 Retry 1 只读诊断执行完成，已定位首次 Core 启动探测失败的首个阻断门禁：

- `blockingGate=state_directory`
- `likelyOriginalExitCode=214`
- `stateDirectoryValid=false`
- `originalPreflightWouldPass=false`
- `readyForCorrectedStage50Retry=false`
- `nextAuthorizedOperation=repair_identified_stage50_preflight_gate`

本次诊断未启动或停止 Core，未创建文件，未修改生产配置、staging、TUN、路由、DNS 或防火墙。

## 真机结果

- `ok=true`
- `stage=production_stage50_retry1_readonly_preflight_diagnostic`
- `authorizationConsumed=false`
- `automaticRetryAllowed=false`
- `manualOnly=true`
- `readOnlyDiagnostic=true`
- `completionMarkerObserved=true`
- `shellUid=0`

## 已通过条件

- Runtime 根目录有效；
- `config` 目录有效；
- `logs` 目录有效；
- sing-box 二进制有效；
- 生产配置有效，权限 `0600`，uid/gid 为 `0/0`；
- staging 数量为 1，文件类型有效；
- 生产配置与 staging 的 SHA-256、字节数一致；
- `sing-box check` 返回 `0`；
- 活动 PID 和活动元数据均不存在；
- 精确匹配 Core 数量为 0；
- `sbh-tun0` 不存在；
- IPv4/IPv6 规则 `8800–8815` 数量均为 0；
- IPv4/IPv6 路由表 `20240` 数量均为 0。

## 阻断原因

Stage 50 原前置门禁要求：

```sh
[ -d "$STATE" ] && [ ! -L "$STATE" ]
```

真机返回 `stateDirectoryValid=false`，因此原脚本会在退出码 `214` 处停止，尚未进入 Core 派发。

当前证据说明 `Runtime/state` 不满足“普通目录且非符号链接”的条件。下一阶段只允许针对该路径执行精确修复；若路径被普通文件或符号链接占用，必须安全拒绝，不覆盖、不删除。

## 安全边界

- `coreStartInvoked=false`
- `coreStopInvoked=false`
- `runtimeFilesModified=false`
- `configModified=false`
- `tunCreated=false`
- `routeModified=false`
- `networkAccessed=false`
- `destructiveOperations=false`

## 下一阶段

Stage 50 Retry 2：

1. 再次确认生产配置/staging 血缘、Core 和网络资源仍保持安全状态；
2. 若 `Runtime/state` 不存在，则创建为 `0700`、uid/gid `0/0`；
3. 若路径已被普通文件或符号链接占用，则不修改并返回冲突；
4. 修复后复核配置、staging、Core、TUN、规则和路由均未改变；
5. 本阶段仍不启动 Core。
