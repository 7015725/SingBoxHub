# Runtime Stage 54：生产生命周期 UI 提升

## 输入状态

Stage 53 Retry 4 真机已确认：

- Runtime 控制服务 PID `19373` 存活并保持运行；
- 生产 Core PID `21156` 已按控制器持有契约启动并稳定运行 4 秒；
- `STOP_CORE` 后 Core 数量降为 `0`；
- Runtime `STATUS=STOPPED`；
- 最终 `PING=PONG`；
- 生命周期审计已写入 `state/core-lifecycle-integration-last.json`；
- TUN、规则 `8800–8815` 与路由表 `20240` 全程为空；
- `nextAuthorizedOperation=runtime_production_lifecycle_ui_promotion`。

## 授权边界

- 授权 ID：`stage54-runtime-production-lifecycle-ui-promotion-user-authorized-20260805`
- 来源生命周期授权：`stage53-retry4-runtime-core-lifecycle-controller-owned-user-authorized-20260805`
- 自动重试：禁用
- 提升门禁：手动执行一次
- 自动启动或停止 Core：禁用
- 首页精确状态刷新：启用
- 首页启动和停止控制表面：安装，但写操作保持锁定
- 直接 TERM/KILL：禁用
- TUN、路由、DNS、防火墙及节点连通性测试：禁用

Stage 54 只提升生产 UI 和只读状态控制，不在同一阶段开放长期可用的启动、停止写操作。启动和停止按钮会显示，但在 Stage 55 验收前只返回锁定提示。

## 实现与入口

新增：

- 仓库模块：`src/sbh_81_runtime_production_lifecycle_ui_promotion.js`
- 模块形式：Rhino ES5 GZIP 包装模块，运行时解压并执行完整可读源码
- 包装模块 SHA-256：`2c4f8564dddf95cb2c192b0b0e7906ff9dff30e50e86e6c7e43db09fd77e3692`
- 包装模块字节数：`15320`
- 内部完整源码 SHA-256：`6e5d51ffcff0e4df4c24233aed9ee8152b06cfffa89780bd864ab14d4c95a239`
- 内部完整源码字节数：`40159`
- 测试入口：`SingBoxHub_Stage54_生产生命周期UI提升.txt`
- 入口版本：`81`
- 入口 SHA-256：`74ac70c1f10d0ddb5e27b55d81fe695f8d3d11ad2f7f88696c607f9a022cc940`
- 入口字节数：`34132`
- 模块集：`20260803.22+stage54-production-lifecycle-ui-promotion-inline`

## 提升前置门禁

用户在节点页面点击“校验并提升生产生命周期 UI”后，重新验证：

1. ShortX Shell uid 为 `0`；
2. Runtime、config、state、control 和工作目录类型有效且不是符号链接；
3. state 为 `0700`、root 所有；
4. Runtime JAR、生产 sing-box 二进制及生产配置存在且类型有效；
5. 生产配置为 `0600`、root 所有；
6. staging 恰好一个，生产配置与 staging 的 SHA-256 和字节数一致；
7. `sing-box check` 返回 `0`；
8. 控制服务恢复审计存在，为 `0600`、root 所有；
9. 生命周期审计存在，为 `0600`、root 所有；
10. 生命周期审计包含 Stage 53 Retry 4 授权 ID 和 `finalCoreState=stopped`；
11. endpoint 为 canonical 普通文件，`0600`、root 所有；
12. Runtime PID 存活，cmdline 与 uid/gid 验证通过；
13. 控制器持有 Core 和宽松生产 Core 候选均为 `0`；
14. `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空；
15. 通过认证 LocalSocket 发送一次只读 `STATUS`，要求 `STOPPED` 或 `ALREADY_STOPPED`。

任一条件不满足时不提升，也不执行任何 Core 写操作。

## 控制器持有 Core 契约

生产 UI 沿用真机确认的联合身份：

```text
PID != Runtime PID
PPid == Runtime PID
uid == 0
state != Z
argv0 == production sing-box binary
binary argument index == 0
production config exists at any later argument index
```

同时统计不要求 PPid 的宽松候选。提升门禁要求控制器持有和宽松候选均为 `0`，拒绝在存在孤立或身份不明生产 Core 时提升。

## 提升后的首页

首页首屏替换为生产生命周期界面，展示：

- Runtime 控制服务 PID；
- Core 当前为停止状态；
- 控制器持有身份契约；
- TUN、预留规则和路由保持为空；
- `刷新`、`启动`、`停止` 三个控制表面。

### 刷新

`刷新` 已启用。每次执行都会重新完成完整 Shell 前置门禁和一次认证 `STATUS`，只接受干净停止状态，并同步顶部 Runtime 徽标。

### 启动与停止

`启动` 和 `停止` 在 Stage 54 中保持锁定：

```text
启动/停止写操作将在 Stage 55 验收后启用
```

Stage 54 不发送 `START`、`STOP_CORE`、TERM 或 KILL。

## 提升审计

门禁通过后原子写入：

`state/production-lifecycle-ui-promotion.json`

权限：

- mode `0600`
- uid/gid `0/0`

审计记录：

- Stage 与授权 ID；
- 来源生命周期授权；
- Runtime PID；
- 已安装的状态控制和启动/停止控制表面；
- `writeActionsLocked=true`；
- `automaticCoreAction=false`；
- 提升时间。

不包含 token、socketName、correlation、节点凭据或配置正文。

## 预期通过结果

```text
ok=true
stage=production_stage54_runtime_production_lifecycle_ui_promotion
preflightPassed=true
shellUid=0
productionConfigCheckPassed=true
lifecycleAuditVerified=true
lifecycleAuditFinalCoreState=stopped
controlServiceProcessAlive=true
currentRuntimeStatus=STOPPED
currentCoreState=stopped
currentControllerOwnedCoreCount=0
currentLooseCoreCandidateCount=0
productionLifecycleUiPromoted=true
statusControlInstalled=true
startControlSurfaceInstalled=true
stopControlSurfaceInstalled=true
writeActionsLocked=true
automaticCoreActionInvoked=false
coreStartInvoked=false
coreStopInvoked=false
directProcessSignalEnabled=false
promotionAuditCreated=true
tunInterfacePresent=false
reservedNetworkResourcesUnchanged=true
readyForProductionLifecycleUiAcceptance=true
nextAuthorizedOperation=runtime_production_lifecycle_ui_acceptance
```

## 写入与安全边界

本阶段只允许写入生产 UI 提升审计；不修改：

- `config/runtime-tun.json`；
- staging 或正式备份；
- TUN、规则、路由、DNS 或防火墙。

不执行节点连通性测试，不产生代理测试流量，不暴露敏感 endpoint 数据，不自动重试。

## 静态验证

- 完整源码 JavaScript 语法检查：通过；
- 包装模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- 快照 Shell `sh -n`：通过；
- 提升审计 Shell `sh -n`：通过；
- GitHub 包装模块 Git blob 与本地生成内容完全一致；
- 入口内嵌包装模块 SHA-256 与声明一致；
- 真机验证：待执行。
