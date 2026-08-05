# Runtime Stage 53 Retry 4：控制器持有 Core 启停闭环

## 输入状态

Stage 53 Retry 3 真机已确认：

- Runtime 控制服务 PID `19373` 保持运行；
- 原 Core PID `8011` 已停止；
- 控制器持有 Core 数量为 `0`；
- Runtime `STATUS=STOPPED`；
- 最终 `PING=PONG`；
- TUN、规则和路由均为空；
- `nextAuthorizedOperation=retry_runtime_core_lifecycle_with_controller_owned_process_contract`。

## 授权

- 授权 ID：`stage53-retry4-runtime-core-lifecycle-controller-owned-user-authorized-20260805`
- 来源停止归一化授权：`stage53-retry3-runtime-stop-core-controller-owned-process-reconcile-user-authorized-20260805`
- 自动重试：禁用
- `STATUS`：最多两次
- `START`：最多一次
- `STOP_CORE`：最多一次
- 最终 `PING`：最多一次
- Runtime 控制服务停止：禁用
- TUN、路由、DNS、防火墙和节点连通性测试：禁用

## 实现

新增：

- `src/sbh_80_runtime_core_lifecycle_controller_owned_retry.js`
- 模块版本：`runtimeCoreLifecycleControllerOwnedRetry=1`
- 模块 SHA-256：`6a7215743adf5b65db77d20aa26db0ff2ba3bf876f6a4c5a4db28350f0f7aa06`
- 模块字节数：`56175`
- 测试入口：`SingBoxHub_Stage53_控制器持有Core启停闭环重试4.txt`
- 入口版本：`80`
- 入口 SHA-256：`c884feab1cc95dda500e123b428c5aa79347f97ef4a842d39af45df403905734`
- 入口字节数：`77485`
- 模块集：`20260803.22+stage53-retry4-controller-owned-core-lifecycle-inline`

## 控制器持有 Core 身份契约

不再要求旧四参数形式：

```text
<binary> run -c <config>
```

改为真机确认的联合身份：

```text
PID != Runtime PID
PPid == Runtime PID
uid == 0
state != Z
argv0 == production sing-box binary
binary argument index == 0
production config exists in argv at index >= 1
```

Stage 53 Retry 2 已证明真机配置位于参数索引 `5`，因此配置参数位置不再固定。

## 单次事务

```text
前置 Shell 门禁
    ↓
STATUS，必须 STOPPED/ALREADY_STOPPED
    ↓
START，最多一次
    ↓
等待并锁定唯一控制器持有 Core
    ↓
验证 PID、PPid、uid、argv0、config 参数和 4 秒稳定性
    ↓
STOP_CORE，最多一次
    ↓
确认控制器持有 Core 数量降为 0
    ↓
STATUS，必须 STOPPED/ALREADY_STOPPED
    ↓
PING，必须 PONG
    ↓
写入生命周期审计
```

## 前置门禁

发送 `START` 前重新验证：

1. ShortX Shell uid 为 `0`；
2. Runtime、配置、state、logs、control 和工作目录类型有效；
3. state 为 `0700`、root 所有；
4. Runtime JAR、生产二进制和生产配置类型有效；
5. 生产配置为 `0600`、root 所有；
6. staging 恰好一个，生产配置与 staging 哈希和字节数一致；
7. `sing-box check` 返回 `0`；
8. 控制服务恢复审计存在且为 `0600`、root 所有；
9. endpoint canonical、`0600`、root 所有；
10. Runtime PID 存活、身份匹配、uid/gid 为 `0/0`；
11. 控制器持有 Core 数量为 `0`；
12. `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空；
13. Runtime `STATUS` 为 `STOPPED` 或 `ALREADY_STOPPED`。

任一条件不满足时不发送 `START`。

## START 后核验

- 最多等待 6 秒发现 Core；
- 控制器持有 Core 数量必须为 `1`；
- PID 在 4 秒稳定期前后必须一致；
- PPid 必须等于 Runtime PID；
- uid 必须为 `0`；
- argv0 必须为生产 sing-box 二进制；
- binary 参数索引必须为 `0`；
- 生产配置参数索引必须大于等于 `1`；
- 进程状态不能为 `Z`；
- Runtime 控制服务必须继续运行；
- TUN、规则和路由必须继续为空。

## STOP_CORE 后核验

- 最多等待 6 秒；
- 控制器持有 Core 数量必须降为 `0`；
- Runtime 控制服务必须继续运行；
- TUN、规则和路由必须继续为空；
- Runtime `STATUS` 必须为 `STOPPED` 或 `ALREADY_STOPPED`；
- 最终 `PING` 必须返回 `PONG` 且 correlation 匹配。

## 精确失败回滚

若 `START` 后已经锁定精确 Core PID，而后续门禁失败：

1. 再次确认 PID 仍满足控制器持有身份；
2. 仅向该 PID 发送 `SIGTERM`；
3. 最多等待 3 秒；
4. 仍存活且身份不变时才发送 `SIGKILL`；
5. 要求控制器持有 Core 数量降为 `0`；
6. 不停止 Runtime 控制服务；
7. 不使用 `pkill` 或 `killall`。

## 审计与写入范围

成功后原子写入：

`state/core-lifecycle-integration-last.json`

权限为 `0600`、root 所有。审计不包含 token、socketName、correlation、节点凭据或配置正文。

除审计与 Runtime 既有日志外，不修改生产配置、staging、备份、TUN、路由、DNS 或防火墙。

## 预期通过结果

```text
ok=true
preflightPassed=true
shellUid=0
productionConfigCheckPassed=true
controlServiceProcessAliveBefore=true
controlServiceOwnerValidated=true
existingControllerOwnedCoreCountBefore=0
controllerOwnedProcessContract=ppid_runtime_uid0_argv0_binary_config_any_index
statusBeforeResponseStatus=STOPPED
runtimeClaimedStoppedBefore=true
startCommandSent=true
startRequestCount=1
startCorrelationMatched=true
coreStartInvoked=true
coreProcessVisible=true
coreControllerOwnedIdentityValidated=true
coreProcessControllerOwned=true
coreProcessParentPid=<runtime pid>
coreProcessOwnerUid=0
coreProcessBinaryArgumentIndex=0
coreProcessConfigArgumentIndex>=1
startStabilizationPassed=true
stopCommandSent=true
stopRequestCount=1
stopCorrelationMatched=true
coreStopInvoked=true
matchingCoreCountAfter=0
finalCoreState=stopped
statusAfterResponseStatus=STOPPED
runtimeClaimedStoppedAfter=true
finalPingResponseStatus=PONG
finalPingCorrelationMatched=true
controlServiceRemainsRunning=true
lifecycleAuditCreated=true
tunInterfacePresentBefore=false
tunInterfacePresentDuring=false
tunInterfacePresentAfter=false
reservedNetworkResourcesUnchanged=true
rollbackInvoked=false
controllerOwnedProcessContractVerified=true
readyForProductionLifecycleUi=true
nextAuthorizedOperation=runtime_production_lifecycle_ui_promotion
```

## 静态验证

- 模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- 前置、启动观察、停止观察、精确回滚和审计共 5 组生成 Shell 的 `sh -n`：通过；
- 入口内嵌源码与仓库模块完全一致；
- 真机验证：待执行。
