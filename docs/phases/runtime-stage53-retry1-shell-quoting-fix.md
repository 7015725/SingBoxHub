# Runtime Stage 53 Retry 1：修复 Shell 引号并重新验证生命周期闭环

## 授权

- 授权 ID：`stage53-retry1-runtime-core-lifecycle-integration-user-authorized-20260805`
- 来源控制服务恢复授权：`stage52-retry1-runtime-control-service-recovery-user-authorized-20260805`
- 自动重试：禁用
- `START`：最多一次
- `STOP_CORE`：最多一次
- 最终认证 `PING`：最多一次
- Runtime 控制服务停止：禁用
- TUN、路由、DNS、防火墙和节点连通性测试：禁用
- 最终 Core 状态：必须为 `stopped`

## 测试入口

- 文件：`SingBoxHub_Stage53_RuntimeCore启停闭环重试1.txt`
- 入口版本：`77`
- 模块名：`sbh_77_runtime_core_lifecycle_integration_retry1.js`
- 模块 SHA-256：`9aebc24835fb6a14292b9050f7c0a76753d21ad1110dcf380409469382255629`
- 模块字节数：`50902`
- 入口 SHA-256：`5cac2ee4af370e05cdddb9435d261251efb4217372d26b72d66ebce138cfc2c6`
- 入口字节数：`71782`
- 模块集：`20260803.22+stage53-retry1-shell-quoting-fix-inline`

## 修复内容

### 1. Shell 双引号恢复为标准 JavaScript 转义

错误源码：

```javascript
"P=\\\"$1\\\""
"[ \\\"$UIDV\\\" = 0 ]"
```

修复后：

```javascript
"P=\"$1\""
"[ \"$UIDV\" = 0 ]"
```

生成 Shell 现在为：

```sh
P="$1"
[ "$UIDV" = 0 ]
```

### 2. `tr` 转义恢复

错误源码中的四重反斜杠：

```javascript
"tr '\\\\000' '\\\\n'"
```

修复后：

```javascript
"tr '\\000' '\\n'"
```

生成 Shell 为：

```sh
tr '\000' '\n'
```

### 3. 增加 uid 证据

前置 Shell 新增：

```text
__SBH_UID__=<id -u>
```

结果新增：

```text
shellQuotingFixed=true
shellUid=0
```

## 生命周期事务

修复不改变 Stage 53 的操作边界：

```text
精确前置门禁
  -> 认证 START
  -> 精确 Core PID/uid/4 秒稳定性核验
  -> 认证 STOP_CORE
  -> 精确停止与网络资源核验
  -> 最终认证 PING
  -> 原子写入生命周期审计
```

最终必须满足：

- Core 数量为 `0`；
- Runtime 控制服务继续运行；
- `sbh-tun0` 不存在；
- IPv4/IPv6 规则 `8800–8815` 均为 `0`；
- IPv4/IPv6 路由表 `20240` 均为 `0`；
- 生产配置与 staging 未修改。

## 静态和隔离验证

已完成：

- 修复模块 JavaScript 语法检查通过；
- 完整入口 JavaScript 语法检查通过；
- Rhino ES5 禁用语法扫描通过；
- 内嵌源码 SHA-256 与入口声明一致；
- 前置、START 后观察、STOP 后观察、精确回滚、审计共 5 组生成 Shell 的 `sh -n` 全部通过；
- 隔离环境以 uid `0` 执行前置 Shell，输出：

```text
__SBH_UID__=0
__SBH_GATE__=runtime_root
__SBH_CODE__=702
__SBH_PREFLIGHT_DONE__=1
```

这证明 `root_uid` 已正常通过，脚本继续进入下一门禁；`runtime_root` 是隔离测试环境故意不存在造成的预期结果。

## 预期真机结果

```text
ok=true
shellQuotingFixed=true
shellUid=0
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
reservedNetworkResourcesUnchanged=true
rollbackInvoked=false
readyForProductionLifecycleUi=true
nextAuthorizedOperation=runtime_production_lifecycle_ui_promotion
```

真机验证：待执行。
