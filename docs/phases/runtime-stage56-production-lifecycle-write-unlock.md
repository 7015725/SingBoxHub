# Runtime Stage 56：生产生命周期写操作解锁

## 输入状态

Stage 55 真机验收已通过：

- `productionLifecycleUiAcceptancePassed=true`
- `manualUiChecklistAcknowledged=true`
- `statusRefreshAccepted=true`
- 状态、启动和停止控制表面均已验收；
- Runtime 控制服务 PID `19373` 存活；
- Runtime 为 `STOPPED`；
- 控制器持有 Core 和宽松 Core 候选均为 `0`；
- 验收审计 `state/production-lifecycle-ui-acceptance.json` 已写入；
- `nextAuthorizedOperation=runtime_production_lifecycle_write_unlock`。

## 授权边界

- 授权 ID：`stage56-runtime-production-lifecycle-write-unlock-user-authorized-20260805`
- 来源验收授权：`stage55-runtime-production-lifecycle-ui-acceptance-user-authorized-20260805`
- 来源生命周期授权：`stage53-retry4-runtime-core-lifecycle-controller-owned-user-authorized-20260805`
- 自动重试：禁用
- 解锁事务本身自动 START/STOP_CORE：禁用
- 首页手动 START：解锁后启用
- 首页手动 STOP_CORE：解锁后启用
- 系统 TERM/KILL：禁用
- TUN、规则、路由、DNS、防火墙：禁用
- 节点连通性测试：禁用

## 实现与入口

- 测试入口：`SingBoxHub_Stage56_生产生命周期写操作解锁.txt`
- 入口版本：`83`
- 入口 SHA-256：`ce9f6d7233fb8471feeb0258550b8635a68bd59e5de42b734b4d0f1bb10c9d08`
- 包装模块：`sbh_83_runtime_production_lifecycle_write_unlock.js`
- 包装模块 SHA-256：`7d78a2a9b54eaa70e012f7fddbce162cb8bc0789e2187321da2f4c207cdbd03a`
- 原始模块 SHA-256：`7d98640b457ec95c2151d7435e2c8a99614173db04bc1e30fcbf2b42ce2b1789`
- 模块集：`20260803.22+stage56-production-lifecycle-write-unlock-inline`

## 解锁门禁

点击节点页“校验并解锁生产生命周期写操作”时重新验证：

1. ShortX Shell uid 为 `0`；
2. Runtime、配置、state、控制目录及工作目录类型正确且非符号链接；
3. `state` 为 `0700`、root 所有；
4. Runtime JAR、sing-box 二进制和生产配置有效；
5. 生产配置为 `0600`、root 所有；
6. staging 恰好一个，生产配置和 staging 的 SHA-256 与字节数一致；
7. `sing-box check` 返回 `0`；
8. Stage 53 生命周期审计存在、权限正确、来源授权匹配；
9. Stage 55 验收审计存在、权限正确、来源授权匹配，并确认人工清单、状态刷新与原写锁；
10. canonical endpoint 存在，权限、所有者及路径正确；
11. Runtime 控制服务 PID 存活、身份匹配、uid/gid 为 `0/0`；
12. 控制器持有 Core 和宽松 Core 候选均为 `0`；
13. Runtime `STATUS` 返回 `STOPPED` 或 `ALREADY_STOPPED`；
14. `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空。

任一门禁失败时不写入解锁审计，也不发送 START 或 STOP_CORE。

## 解锁审计

通过后原子写入：

`state/production-lifecycle-write-unlock.json`

审计为 `0600`、uid/gid `0/0`，记录：

- Stage 和授权 ID；
- 来源 Stage 55 授权 ID；
- Runtime PID；
- `writeActionsUnlocked=true`；
- `manualOnly=true`；
- `automaticRetry=false`；
- `directProcessSignal=false`；
- 控制器持有身份契约；
- 时间戳。

不写入 token、socketName、correlation、配置正文或节点凭据。

## 解锁后的首页行为

首页三个按钮：

- **刷新**：只读 STATUS 与 root Shell 精确状态核验；
- **启动**：仅在 Core 已停止且候选为 `0` 时发送一次认证 `START`；
- **停止**：仅在恰好存在一个控制器持有 Core 时发送一次认证 `STOP_CORE`。

Core 身份契约：

```text
PPid == Runtime PID
uid == 0
state != Z
argv0 == 生产 sing-box 二进制
binary 参数索引 == 0
生产配置位于任意后续参数
```

启动后要求唯一 Core 稳定存活 4 秒，Runtime `STATUS=RUNNING`，最终 `PING=PONG`。停止后要求 Core 数量降为 `0`，Runtime `STATUS=STOPPED`，控制服务继续运行，最终 `PING=PONG`。

每次成功手动操作会覆盖写入：

`state/production-lifecycle-last-operation.json`

## 失败边界

- 启动后精确核验失败时，只允许通过控制服务发送一次 `STOP_CORE` 作为事务回滚；
- 不发送系统 TERM/KILL；
- 不使用 `pkill` 或 `killall`；
- 不修改生产配置、staging 或备份；
- 不创建 TUN，不修改规则、路由、DNS 或防火墙；
- 不执行节点连通性测试。

## 本阶段先执行的操作

本次真机首先只执行解锁门禁，不立即测试启动和停止：

1. 运行入口；
2. 进入节点页；
3. 点击一次“校验并解锁生产生命周期写操作”；
4. 返回完整解锁 JSON。

解锁通过后进入手动控制验收，再按顺序测试首页“刷新 → 启动 → 刷新 → 停止 → 刷新”。

## 预期解锁结果

```text
ok=true
preflightPassed=true
shellUid=0
productionConfigCheckPassed=true
acceptanceAuditVerified=true
controlServicePid=19373
controlServiceProcessAlive=true
currentRuntimeStatus=STOPPED
currentCoreState=stopped
currentControllerOwnedCoreCount=0
currentLooseCoreCandidateCount=0
writeActionsUnlocked=true
statusControlEnabled=true
startControlEnabled=true
stopControlEnabled=true
automaticCoreActionInvoked=false
coreStartInvoked=false
coreStopInvoked=false
directProcessSignalEnabled=false
unlockAuditCreated=true
tunInterfacePresent=false
reservedNetworkResourcesUnchanged=true
readyForProductionLifecycleManualControlAcceptance=true
nextAuthorizedOperation=runtime_production_lifecycle_manual_control_acceptance
```

## 静态验证

- 原始模块 JavaScript 语法检查：通过；
- 包装模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- snapshot、启动观察、停止观察、解锁审计和操作审计 Shell 的 `sh -n`：通过；
- 入口内嵌包装模块 SHA-256 与声明一致；
- 真机验证：待执行。
