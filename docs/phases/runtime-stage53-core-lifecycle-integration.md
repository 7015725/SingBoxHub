# Runtime Stage 53：Core 生命周期启停闭环

## 输入状态

Stage 52 Retry 1 真机已确认：

- Runtime 控制服务 PID `19373` 存活；
- canonical endpoint 已发布并通过 mode、owner、schema 与路径门禁；
- 一次认证 `PING` 返回 `PONG`，correlation 匹配；
- sing-box Core 当前未运行；
- 生产配置与 staging 血缘一致，`sing-box check` 通过；
- `sbh-tun0`、规则 `8800–8815` 与路由表 `20240` 均为空；
- `nextAuthorizedOperation=runtime_core_lifecycle_control_integration`。

## 授权边界

- 授权 ID：`stage53-runtime-core-lifecycle-integration-user-authorized-20260805`
- 来源恢复授权 ID：`stage52-retry1-runtime-control-service-recovery-user-authorized-20260805`
- 自动重试：禁用
- `START` 请求：最多一次
- `STOP_CORE` 请求：最多一次
- 最终认证 `PING`：最多一次
- Runtime 控制服务停止：禁用
- TUN、规则、路由、DNS、防火墙：禁用
- 节点连通性测试和代理流量：禁用
- 最终 Core 状态：必须为 `stopped`

## 实现

新增：

- `src/sbh_76_runtime_core_lifecycle_integration.js`
- 模块内部版本：`runtimeCoreLifecycleIntegration=1`
- 模块 SHA-256：`ff70696289767d3d0f2346276db36448c7f2474599740e2881cd9aa504b0546f`
- 模块字节数：`50897`
- 测试入口：`SingBoxHub_Stage53_RuntimeCore启停闭环.txt`
- 入口版本：`76`
- 入口 SHA-256：`0d49e259be8c2c83f817fcc1b9cabbf8c61daeabbc716b3cd5ac9f1b9621ec20`
- 入口字节数：`72625`
- 模块集：`20260803.22+stage53-core-lifecycle-integration-inline`

## 单次闭环事务

用户点击一次“验证 Runtime Core 启停闭环”后，执行：

```text
精确前置门禁
    ↓
认证 START
    ↓
精确 PID/uid/稳定性/资源核验
    ↓
认证 STOP_CORE
    ↓
精确停止结果与资源核验
    ↓
最终认证 PING
    ↓
写入生命周期审计
```

最终必须满足：

- sing-box Core 数量为 `0`；
- Runtime 控制服务继续存活；
- endpoint 继续有效；
- `sbh-tun0` 不存在；
- 规则 `8800–8815` 和路由表 `20240` 为空；
- 生产配置和 staging 未修改。

## 前置门禁

执行 `START` 前重新验证：

1. ShortX Shell uid 为 `0`；
2. Runtime、`config`、`state`、`logs`、`runtime/control`、工作目录均为预期类型且非符号链接；
3. `state` 为 `0700`、uid/gid 为 `0/0`；
4. Runtime JAR 与 sing-box 二进制存在且类型有效；
5. 生产配置为 `0600`、uid/gid 为 `0/0`；
6. staging 恰好一个，生产配置与 staging 的 SHA-256 和字节数一致；
7. `sing-box check` 返回 `0`；
8. `state/control-service-last-recovery.json` 为 `0600`、root 所有；
9. endpoint 为 canonical 普通文件，`0600`、root 所有；
10. endpoint PID 存活，cmdline 匹配 `CoreRuntimeMain`、生产配置和 Runtime 工作目录；
11. 控制服务 uid/gid 为 `0/0`；
12. 精确匹配生产配置的 Core 数量为 `0`；
13. `sbh-tun0`、规则和路由均为空。

任一条件不满足时不发送 `START`。

## Runtime 协议调用

每条命令使用独立 Android `LocalSocket` 连接，固定三行请求：

```text
<token>\n
<one-shot correlation>\n
<command>\n
```

读取两行响应：

```text
<status>\n
<same correlation>\n
```

调用顺序：

```text
LocalSocket()
connect(LocalSocketAddress)
setSoTimeout(2500)
```

不使用双参数 `connect` 重载。结果不暴露 token、socketName 或 correlation。

## START 后精确核验

发送 `START` 后：

1. 最多等待 6 秒发现 Core；
2. 要求精确匹配进程数量为 `1`；
3. argv 必须精确为生产二进制、`run`、`-c`、生产配置；
4. uid 必须为 `0`；
5. 进程状态不能为 `Z`；
6. 继续稳定存活 `4` 秒；
7. 控制服务必须仍存活且身份匹配；
8. TUN、规则和路由必须继续为空。

不执行节点连通性测试，不产生代理测试流量。

## STOP_CORE 后精确核验

发送 `STOP_CORE` 后：

1. 最多等待 `6` 秒；
2. 精确匹配 Core 数量必须降为 `0`；
3. Runtime 控制服务必须继续存活；
4. TUN、规则和路由必须继续为空；
5. 随后发送一次 `PING`，要求 `PONG` 与 correlation 匹配。

本阶段不发送 `STOP_RUNTIME`。

## 精确失败回滚

如果 `START` 后已识别精确 Core PID，而后续任一门禁失败：

1. 再次验证 PID argv 与生产配置身份；
2. 仅向该 PID 发送 `SIGTERM`；
3. 最多等待 3 秒；
4. 仍存活且身份仍匹配时发送 `SIGKILL`；
5. 要求精确匹配 Core 数量降为 `0`；
6. 不停止 Runtime 控制服务；
7. 不使用 `pkill`、`killall` 或模糊进程名称。

若 PID 身份发生变化，不向新身份发送信号，并返回需要精确核对的状态。

## 生命周期审计

闭环完整通过后原子写入：

`state/core-lifecycle-integration-last.json`

权限：

- mode `0600`
- uid/gid `0/0`

审计仅包含：

- Stage 与授权 ID；
- Runtime PID；
- 本次 Core PID；
- START、STOP_CORE 与最终 PING 的脱敏状态；
- 最终 Core 状态 `stopped`；
- 时间戳。

不包含 token、socketName、correlation、节点凭据或配置正文。

## 写入范围

仅允许成功时写入：

- `state/core-lifecycle-integration-last.json`
- 对应同目录审计临时文件
- Runtime 控制服务自身启动 Core 产生的既有运行日志

明确禁止修改：

- `config/runtime-tun.json`
- staging
- 正式备份
- TUN、规则、路由、DNS、防火墙

## 预期通过结果

```text
ok=true
lifecycleTransactionMode=authenticated_start_exact_reconcile_stop_final_ping
preflightPassed=true
productionConfigCheckPassed=true
controlServiceProcessAliveBefore=true
controlServiceOwnerValidated=true
controlServiceRemainsRunning=true
existingMatchingCoreCountBefore=0
startCommandSent=true
startRequestCount=1
startCorrelationMatched=true
coreStartInvoked=true
coreProcessVisible=true
coreProcessIdentityValidated=true
coreProcessOwnerUid=0
startStabilizationPassed=true
stopCommandSent=true
stopRequestCount=1
stopCorrelationMatched=true
coreStopInvoked=true
matchingCoreCountAfter=0
finalCoreState=stopped
finalPingSent=true
finalPingResponseStatus=PONG
finalPingCorrelationMatched=true
lifecycleAuditCreated=true
tunInterfacePresentBefore=false
tunInterfacePresentDuring=false
tunInterfacePresentAfter=false
reservedIpv4RuleCountAfter=0
reservedIpv6RuleCountAfter=0
reservedIpv4RouteCountAfter=0
reservedIpv6RouteCountAfter=0
reservedNetworkResourcesUnchanged=true
rollbackInvoked=false
configModified=false
stagingModified=false
readyForProductionLifecycleUi=true
nextAuthorizedOperation=runtime_production_lifecycle_ui_promotion
```

`startResponseStatus` 与 `stopResponseStatus` 由 Runtime JAR 真机返回，模块只要求状态非空、correlation 匹配，且不包含受控错误标识；最终业务结论以精确进程状态为准。

## 验证

- 模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- 前置、启动观察、停止观察、回滚和审计 Shell 的 `sh -n`：通过；
- 入口内嵌源码 SHA-256 与仓库模块一致；
- 真机验证：待执行。
