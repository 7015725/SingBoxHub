# Runtime Stage 53 Retry 1 真机结果：Runtime 报告 ALREADY_RUNNING，但精确 Core 未发现

## 结论

Stage 53 Retry 1 已修复 Shell 引号问题，前置门禁完整通过，但生命周期闭环在 `START` 后精确核验阶段失败。

Runtime 控制服务对单次认证 `START` 返回：

```text
ALREADY_RUNNING
```

与此同时，root Shell 在 `START` 前确认精确匹配 Core 数量为 `0`，`START` 后观察也未发现符合预期 argv 的 sing-box Core：

```text
corePid=0
coreProcessVisible=false
coreProcessIdentityValidated=false
coreProcessOwnerUid=-1
coreProcessState=none
startStabilizationPassed=false
```

因此当前存在 **Runtime 内部 Core 状态与 `/proc` 精确进程证据不一致** 的情况。不能继续发送第二次 `START`，也不能直接使用 `pkill`、`killall` 或模糊 PID 终止。

## 真机关键结果

- `ok=false`
- `stage=production_stage53_retry1_runtime_core_lifecycle_integration`
- `shellQuotingFixed=true`
- `shellUid=0`
- `preflightPassed=true`
- `blockingGate=none`
- `preflightCode=0`
- `productionConfigCheckPassed=true`
- Runtime 控制服务 PID：`19373`
- `controlServiceProcessAliveBefore=true`
- `controlServiceOwnerValidated=true`
- `existingMatchingCoreCountBefore=0`
- `startCommandSent=true`
- `startRequestCount=1`
- `startResponseStatus=ALREADY_RUNNING`
- `startCorrelationMatched=true`
- `coreStartInvoked=true`
- `corePid=0`
- `coreProcessVisible=false`
- `startStabilizationPassed=false`
- `stopCommandSent=false`
- `coreStopInvoked=false`
- `finalPingSent=false`
- `rollbackInvoked=false`
- `errorCode=CORE_START_RECONCILIATION_FAILED`
- `nextAuthorizedOperation=resolve_runtime_core_lifecycle_integration_gate`

## 安全状态

本次未进入 `STOP_CORE`，也没有可供精确回滚的 Core PID：

- 未发送进程信号；
- 未修改生产配置或 staging；
- 未创建 TUN；
- 未修改路由、DNS 或防火墙；
- 未执行节点连通性测试；
- 未写入生命周期审计。

顶部“Core 运行中”与 Runtime 返回 `ALREADY_RUNNING` 一致，但目前不能确认这是：

1. Runtime 内部仍持有一个存活 `Process`，其 argv 与当前精确匹配契约不同；
2. Runtime 内部状态或 Process 句柄残留；
3. Core 由控制服务以不同 argv 形态启动；
4. 状态读取和 `/proc` 观察之间存在竞态。

现有截图不能区分以上情况。

## 下一门禁

进入 Stage 53 Retry 2，只读诊断：

- 发送最多一次只读 `STATUS`；
- 枚举所有 argv 中包含生产 sing-box 二进制或生产配置路径的候选进程；
- 统计控制服务直接子进程；
- 返回 PID、PPid、uid、状态、参数数量及二进制/配置参数位置的脱敏摘要；
- 检查 TUN、规则 `8800–8815` 和路由表 `20240`；
- 不发送 `START`、`STOP_CORE` 或任何进程信号；
- 不修改任何 Runtime 文件。
