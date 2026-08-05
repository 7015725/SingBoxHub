# Runtime Stage 55：生产生命周期 UI 验收

## 输入状态

Stage 54 真机门禁已通过：

- `productionLifecycleUiPromoted=true`
- `statusControlInstalled=true`
- `startControlSurfaceInstalled=true`
- `stopControlSurfaceInstalled=true`
- `writeActionsLocked=true`
- Runtime 控制服务 PID `19373` 存活；
- Runtime 状态为 `STOPPED`；
- 控制器持有 Core 与宽松 Core 候选均为 `0`；
- `sbh-tun0`、规则 `8800–8815`、路由表 `20240` 均为空；
- `nextAuthorizedOperation=runtime_production_lifecycle_ui_acceptance`。

Stage 54 入口启动记录同时确认：

- `entryVersion=81`
- `runtimeAttached=true`
- `runtimeState=stopped`
- `runtimeWriteGate=readonly_authenticated`
- `controlServicePid=19373`
- `controlServiceHealthy=true`
- `authenticatedPingVerified=true`
- `coreRunning=false`

## 目标

Stage 55 对生产生命周期首页进行人工与系统联合验收，但继续保持启动和停止写操作锁定。

验收顺序：

1. 在首页点击一次只读“刷新”；
2. 确认 Runtime PID、Core 停止态、身份契约和网络资源状态正确；
3. 确认“刷新 / 启动 / 停止”三个控制表面存在；
4. 确认启动与停止仍显示锁定提示，不会发送 Runtime 写命令；
5. 确认底部导航、页面滚动和关闭按钮无回归；
6. 返回节点页，点击“我已检查首页，确认并记录 UI 验收”。

该按钮点击被视为用户对人工 UI 检查项的明确确认；随后模块会重新执行系统门禁并写入验收审计。

## 授权与边界

- 授权 ID：`stage55-runtime-production-lifecycle-ui-acceptance-user-authorized-20260805`
- 来源提升授权：`stage54-runtime-production-lifecycle-ui-promotion-user-authorized-20260805`
- 来源生命周期授权：`stage53-retry4-runtime-core-lifecycle-controller-owned-user-authorized-20260805`
- 自动重试：禁用
- 状态刷新：只读，手动一次
- START：禁用
- STOP_CORE：禁用
- 系统进程信号：禁用
- TUN、规则、路由、DNS、防火墙：禁用
- 节点连通性测试：禁用
- 写操作解锁：推迟到下一阶段

## 实现

新增：

- `src/sbh_82_runtime_production_lifecycle_ui_acceptance.js`
- 模块内部版本：`runtimeProductionLifecycleUiAcceptance=1`
- 原始模块 SHA-256：`f0eb006e8cce3053866fcfe8e635f88ed686b57d73b2cb3ab89088ff7790696c`
- 包装模块 SHA-256：`3ccd88a9dda79cea92af01675442b802659a7c32b82b5ec5655bf60a90687580`
- 测试入口：`SingBoxHub_Stage55_生产生命周期UI验收.txt`
- 入口版本：`82`
- 入口 SHA-256：`c0694f51ca6f7618b2e69331c56da7f965df55b4a3b2ed7f5312f02f57bc50e9`
- 模块集：`20260803.22+stage55-production-lifecycle-ui-acceptance-inline`

## 系统门禁

每次刷新和最终验收都会重新验证：

1. ShortX Shell uid 为 `0`；
2. Runtime 根目录、配置目录、state、控制目录和工作目录类型正确且非符号链接；
3. `state` 为 `0700`、root 所有；
4. Runtime JAR、sing-box 二进制和生产配置类型正确；
5. 生产配置为 `0600`、root 所有；
6. staging 恰好一个，生产配置与 staging 的 SHA-256 和字节数一致；
7. `sing-box check` 返回 `0`；
8. Stage 53 生命周期审计存在、权限正确、授权 ID 匹配且最终 Core 状态为 `stopped`；
9. Stage 54 提升审计存在、权限正确、授权 ID 匹配；
10. Stage 54 审计确认状态控制、启动/停止表面已安装且写操作仍锁定；
11. canonical endpoint 存在，权限、所有者和路径正确；
12. Runtime 控制服务 PID 存活、身份匹配、uid/gid 为 `0/0`；
13. 控制器持有 Core 和宽松 Core 候选均为 `0`；
14. `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空；
15. 通过认证 LocalSocket 发送一次只读 `STATUS`，必须返回 `STOPPED` 或 `ALREADY_STOPPED`。

任一门禁失败时不写入验收审计，也不发送任何 Core 写命令。

## 验收审计

最终通过后原子写入：

`state/production-lifecycle-ui-acceptance.json`

权限：

- mode `0600`
- uid/gid `0/0`

审计只记录：

- Stage 与授权 ID；
- 来源 Stage 54 授权 ID；
- Runtime PID；
- `manualUiChecklistAcknowledged=true`；
- `statusRefreshAccepted=true`；
- 状态、启动和停止表面已验收；
- `writeActionsRemainLocked=true`；
- `automaticCoreAction=false`；
- 验收时间戳。

不记录 token、socketName、correlation、配置正文或节点凭据。

## 首页行为

### 验收前

- 标题：`生产生命周期 UI 待验收`
- 标签：`待刷新` 或 `已刷新`
- 刷新按钮：执行只读系统门禁与 STATUS
- 启动、停止按钮：仅提示先完成 Stage 55

### 验收后

- 标题：`生产生命周期 UI 验收通过`
- 标签：`验收通过`
- 刷新按钮：继续只读可用
- 启动、停止按钮：仍只提示等待 Stage 56 解锁

## 预期通过结果

```text
ok=true
preflightPassed=true
shellUid=0
productionConfigCheckPassed=true
lifecycleAuditVerified=true
promotionAuditVerified=true
lifecycleAuditFinalCoreState=stopped
controlServicePid=19373
controlServiceProcessAlive=true
currentRuntimeStatus=STOPPED
currentCoreState=stopped
currentControllerOwnedCoreCount=0
currentLooseCoreCandidateCount=0
productionLifecycleUiAcceptancePassed=true
manualUiChecklistAcknowledged=true
statusRefreshAccepted=true
statusControlAccepted=true
startControlSurfaceAccepted=true
stopControlSurfaceAccepted=true
writeActionsLocked=true
writeUnlockDeferredToNextStage=true
automaticCoreActionInvoked=false
coreStartInvoked=false
coreStopInvoked=false
directProcessSignalEnabled=false
acceptanceAuditCreated=true
tunInterfacePresent=false
reservedNetworkResourcesUnchanged=true
readyForProductionLifecycleWriteUnlock=true
nextAuthorizedOperation=runtime_production_lifecycle_write_unlock
```

## 静态验证

- 原始模块 JavaScript 语法检查：通过；
- 包装模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- snapshot Shell `sh -n`：通过；
- acceptance audit Shell `sh -n`：通过；
- 入口内嵌模块 SHA-256 与声明一致；
- gzip 解包后的原始模块 SHA-256 与记录一致；
- 真机验证：待执行。

## 下一阶段

Stage 55 真机通过后进入：

`runtime_production_lifecycle_write_unlock`

下一阶段才允许在生产首页启用手动 START 与 STOP_CORE，并继续使用控制器持有 Core 身份契约、单次命令、精确状态核验和无直接进程信号的边界。
