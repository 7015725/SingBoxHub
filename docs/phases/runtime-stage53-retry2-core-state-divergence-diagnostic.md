# Runtime Stage 53 Retry 2：Runtime/Core 状态分歧只读诊断

## 目标

Stage 53 Retry 1 的前置门禁通过，Runtime 对认证 `START` 返回 `ALREADY_RUNNING`，但 root Shell 在 `START` 前后均未发现符合预期 argv 的 Core。Retry 2 只读取 Runtime 状态和 `/proc` 证据，用于区分：

- Runtime 内部 Process 句柄或状态残留；
- 实际 sing-box 进程 argv 与当前精确匹配契约不同；
- 存在控制服务直接子进程但未命中二进制/配置路径；
- Core 实际已停止，仅 UI 或前次响应陈旧。

## 诊断标识

- 诊断 ID：`stage53-retry2-runtime-core-state-divergence-readonly-20260805`
- 来源授权：`stage53-retry1-runtime-core-lifecycle-integration-user-authorized-20260805`
- 自动重试：禁用
- 状态：只读

## 测试入口

- 文件：`SingBoxHub_Stage53_Core状态分歧只读诊断重试2.txt`
- 入口版本：`78`
- 模块名：`sbh_78_runtime_core_state_divergence_diagnostic.js`
- 模块 SHA-256：`96aa9634f4279146c0f5c922700433d89918891df811151783b08463749c9180`
- 模块字节数：`29772`
- 入口 SHA-256：`536796f04e42094f99bf3e33fae3b7767738d28a863497c3fc7bfadced37e566`
- 入口字节数：`49186`
- 模块集：`20260803.22+stage53-retry2-core-state-divergence-diagnostic-inline`

## 执行内容

1. 重新验证 ShortX Shell uid、Runtime 根目录、生产二进制和生产配置；
2. 再次执行 `sing-box check`；
3. 验证 canonical endpoint、控制服务 PID、cmdline 和 root 所有权；
4. 从 endpoint 读取 token 与 socketName，仅在内存中使用；
5. 通过独立 Android `LocalSocket` 发送最多一次只读 `STATUS`；
6. 枚举 `/proc/*/cmdline`，统计：
   - 精确 argv：`<binary> run -c <production-config>`；
   - argv 任意位置包含生产二进制路径；
   - argv 任意位置包含生产配置路径；
   - 两类候选的并集；
   - Runtime 控制服务直接子进程数量；
7. 对最多 12 个候选返回脱敏摘要：
   - PID、PPid、uid、进程状态；
   - argv 参数数量；
   - 二进制参数索引；
   - 配置参数索引；
   - argv0 分类；
   - 是否符合精确预期参数；
8. 检查 `sbh-tun0`、规则 `8800–8815` 与路由表 `20240`。

## 禁止操作

- 不发送 `START`；
- 不发送 `STOP_CORE` 或 `STOP_RUNTIME`；
- 不发送 TERM/KILL；
- 不创建、修改或删除 Runtime 文件；
- 不修改生产配置、staging 或备份；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙；
- 不执行节点连通性测试；
- 不暴露 token、socketName、correlation 或配置正文。

## 主要结果字段

```text
ok
preflightPassed
shellUid
productionConfigCheckPassed
controlServicePid
controlServiceProcessAlive
controlServiceOwnerValidated
statusCommandSent
statusRequestCount
statusResponseStatus
statusCorrelationMatched
runtimeClaimsCoreRunning
runtimeClaimsCoreStopped
exactMatchingCoreCount
looseBinaryCandidateCount
looseConfigCandidateCount
unionCoreCandidateCount
directControlChildCount
candidateSummaries
stateDivergenceDetected
processArgvContractMismatchDetected
runtimeInternalProcessHandleDivergenceDetected
tunInterfacePresent
reservedIpv4RuleCount
reservedIpv6RuleCount
reservedIpv4RouteCount
reservedIpv6RouteCount
nextAuthorizedOperation
```

## 分流规则

### Runtime 声称运行，且发现非精确候选

```text
stateDivergenceDetected=true
processArgvContractMismatchDetected=true
nextAuthorizedOperation=runtime_stop_core_controller_owned_process_reconcile
```

说明控制服务大概率持有实际进程，但 argv 与当前精确契约不同。下一阶段应通过控制服务发送一次 `STOP_CORE`，并对诊断出的候选 PID 集执行前后核对。

### Runtime 声称运行，但没有任何候选

```text
stateDivergenceDetected=true
runtimeInternalProcessHandleDivergenceDetected=true
nextAuthorizedOperation=runtime_stop_core_stale_internal_state_reconcile
```

说明更接近 Runtime 内部 Process 句柄或状态残留。下一阶段仍只允许一次 `STOP_CORE` 状态归一化，不直接发送系统进程信号。

### Runtime 声称停止且没有候选

```text
runtimeClaimsCoreStopped=true
unionCoreCandidateCount=0
nextAuthorizedOperation=retry_runtime_core_lifecycle_after_clean_stop
```

说明可以在新授权下重新执行生命周期闭环。

### 精确 Core 数量为 1

```text
exactMatchingCoreCount=1
nextAuthorizedOperation=runtime_core_exact_status_and_stop_reconcile
```

下一阶段先通过控制服务 `STOP_CORE`，再核对该精确 PID 已停止。

## 验证

- 模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- 生成 Shell `sh -n`：通过；
- 入口内嵌源码 SHA-256 与模块一致；
- 真机验证：待执行。
