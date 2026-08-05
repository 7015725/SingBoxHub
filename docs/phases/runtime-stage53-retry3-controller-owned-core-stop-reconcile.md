# Runtime Stage 53 Retry 3：控制器持有 Core 停止归一化

## 输入状态

Stage 53 Retry 2 已确认：

- Runtime `STATUS=RUNNING`；
- Runtime 控制服务 PID `19373`；
- 实际 sing-box Core PID `8011`；
- Core PPid 为 `19373`；
- Core uid 为 `0`；
- argv0 为生产 sing-box 二进制；
- 生产配置位于 argv 参数索引 `5`；
- Core 不符合旧四参数匹配规则；
- TUN、规则和路由均为空；
- 下一操作为 `runtime_stop_core_controller_owned_process_reconcile`。

## 授权

- 授权 ID：`stage53-retry3-runtime-stop-core-controller-owned-process-reconcile-user-authorized-20260805`
- 来源诊断 ID：`stage53-retry2-runtime-core-state-divergence-readonly-20260805`
- 自动重试：禁用
- `STATUS`：最多两次
- `STOP_CORE`：最多一次
- 最终 `PING`：最多一次
- 系统进程信号：禁用
- Core 启动：禁用
- Runtime 文件写入：禁用
- TUN、路由、DNS、防火墙：禁用

## 实现

新增：

- `src/sbh_79_runtime_controller_owned_core_stop_reconcile.js`
- 模块版本：`runtimeControllerOwnedCoreStopReconcile=1`
- 模块 SHA-256：`35da75a098812222f54f67d9fc7cd3c975405f8e099e77e693131c4ef0ead83b`
- 模块字节数：`43148`
- 测试入口：`SingBoxHub_Stage53_控制器持有Core停止归一化重试3.txt`
- 入口版本：`79`
- 入口 SHA-256：`a9ab7c10a8a2ac5eda08aeb21f4a375588a18d81e06bb1ab78faf227af1f324d`
- 入口字节数：`63408`
- 模块集：`20260803.22+stage53-retry3-controller-owned-core-stop-reconcile-inline`

## 新的 Core 身份契约

旧规则仅接受：

```text
argv[0] = binary
argv[1] = run
argv[2] = -c
argv[3] = config
```

Retry 2 已证明真机 Core 使用 6 个参数，配置位于索引 5。Retry 3 改用控制器所有权和关键路径联合门禁：

```text
PID != Runtime PID
PPid == Runtime PID
uid == 0
state != Z
argv0 == production sing-box binary
binary argument index == 0
production config exists in argv at index >= 1
```

执行前必须恰好存在一个符合该契约的进程。Runtime 控制服务自身虽然参数中包含二进制和配置路径，但 PPid 为 `1` 且 argv0 不是生产二进制，因此不会被选为 Core。

## 单次操作流程

```text
前置 Shell 门禁与唯一 Core 锁定
    ↓
认证 STATUS，要求 RUNNING
    ↓
认证 STOP_CORE，最多一次
    ↓
等待最多 8 秒
    ↓
核对所选 PID 已消失或身份不再匹配
    ↓
核对控制器持有 Core 数量为 0
    ↓
核对 Runtime 控制服务仍运行
    ↓
认证 STATUS，要求 STOPPED/ALREADY_STOPPED
    ↓
认证 PING，要求 PONG
```

## 前置门禁

发送 `STOP_CORE` 前重新验证：

1. ShortX Shell uid 为 `0`；
2. Runtime 根、生产二进制和生产配置类型有效且非符号链接；
3. `sing-box check` 返回 `0`；
4. endpoint 为普通文件，mode `0600`，uid/gid `0/0`；
5. endpoint PID 存活，cmdline 匹配 Runtime 服务类、生产配置和工作目录；
6. 控制服务 uid/gid 为 `0/0`；
7. endpoint schema、类名、Runtime JAR、binary、config、work 路径全部匹配；
8. 控制器持有 Core 数量恰好为 `1`；
9. `sbh-tun0` 不存在；
10. 规则 `8800–8815` 和路由表 `20240` 均为空。

任一门禁不满足时不发送 `STOP_CORE`。

## 停止后核验

`STOP_CORE` 返回状态只接受：

```text
STOPPED
ALREADY_STOPPED
OK
```

随后检查：

- 所选 PID 不再存活，或 PID 已复用但不再匹配原控制器持有 Core 身份；
- 所有控制器持有 Core 数量为 `0`；
- Runtime 控制服务仍存活并保持原身份；
- TUN、规则和路由仍为空；
- Runtime `STATUS` 为 `STOPPED` 或 `ALREADY_STOPPED`；
- 最终 `PING` 返回 `PONG`，correlation 匹配。

## 失败边界

本阶段不使用系统进程信号。若 `STOP_CORE` 后进程仍存在：

```text
nextAuthorizedOperation=review_controller_owned_core_exact_stop_fallback
```

后续必须另行授权，才可讨论针对已锁定 PID 的身份复核和精确信号方案。

若控制服务异常退出：

```text
nextAuthorizedOperation=recover_runtime_control_service_after_stop_reconcile
```

若 Core 已停止但后续 STATUS 或 PING 未完成：

```text
nextAuthorizedOperation=verify_runtime_stopped_state_after_partial_reconcile
```

## 写入与网络边界

- 不写入任何 Runtime 文件；
- 不修改生产配置、staging 或备份；
- 不启动 Core；
- 不发送 TERM/KILL；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙；
- 不执行节点连通性测试；
- 不产生代理测试流量；
- 不暴露 token、socketName 或 correlation。

## 预期通过结果

```text
ok=true
preflightPassed=true
shellUid=0
productionConfigCheckPassed=true
controlServicePid=19373
controlServiceProcessAliveBefore=true
controlServiceOwnerValidated=true
controllerOwnedCandidateCountBefore=1
selectedCorePid=8011
selectedCoreParentPid=19373
selectedCoreUid=0
selectedCoreArgumentCount=6
selectedCoreBinaryArgumentIndex=0
selectedCoreConfigArgumentIndex=5
selectedCoreControllerOwned=true
statusBeforeCommandSent=true
statusBeforeResponseStatus=RUNNING
statusBeforeCorrelationMatched=true
runtimeClaimedRunningBefore=true
stopCoreCommandSent=true
stopCoreRequestCount=1
stopCoreResponseStatus=STOPPED
stopCoreCorrelationMatched=true
selectedCoreStopped=true
remainingControllerOwnedCoreCount=0
controlServiceRemainsRunning=true
statusAfterCommandSent=true
statusAfterResponseStatus=STOPPED
statusAfterCorrelationMatched=true
runtimeClaimedStoppedAfter=true
finalPingSent=true
finalPingResponseStatus=PONG
finalPingCorrelationMatched=true
tunInterfacePresentBefore=false
tunInterfacePresentAfter=false
reservedIpv4RuleCountAfter=0
reservedIpv6RuleCountAfter=0
reservedIpv4RouteCountAfter=0
reservedIpv6RouteCountAfter=0
reservedNetworkResourcesUnchanged=true
directProcessSignalSent=false
runtimeFilesModified=false
readyForLifecycleRetry=true
nextAuthorizedOperation=retry_runtime_core_lifecycle_with_controller_owned_process_contract
```

PID 与 Runtime 返回状态以真机实际结果为准；关键门禁是父子关系、uid、binary/config 参数位置、进程消失、控制服务存活和最终 `STATUS/PING`。

## 静态验证

- 模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- 入口内嵌源码 SHA-256 与模块一致；
- Rhino ES5 语法：仅使用 `var` 和 ES5 函数；
- 真机验证：待执行。
