# Runtime Stage 54：生产生命周期 UI 提升

## 输入状态

Stage 53 Retry 4 真机已确认：

- Runtime 控制服务 PID `19373` 存活；
- 生产 Core PID `21156` 已按控制器持有契约启动并稳定运行 4 秒；
- `STOP_CORE` 后 Core 数量降为 `0`；
- Runtime `STATUS=STOPPED`；
- 最终 `PING=PONG`；
- 生命周期审计已写入 `state/core-lifecycle-integration-last.json`；
- TUN、规则 `8800–8815` 与路由表 `20240` 全程为空；
- `nextAuthorizedOperation=runtime_production_lifecycle_ui_promotion`。

## 授权

- 授权 ID：`stage54-runtime-production-lifecycle-ui-promotion-user-authorized-20260805`
- 来源生命周期授权：`stage53-retry4-runtime-core-lifecycle-controller-owned-user-authorized-20260805`
- 自动重试：禁用
- 提升门禁：手动执行一次
- 提升门禁自动启动 Core：禁用
- 提升门禁自动停止 Core：禁用
- 生产状态、启动、停止动作：安装到首页
- 直接 TERM/KILL：禁用
- TUN、路由、DNS、防火墙及节点连通性测试：禁用

## 实现

新增：

- `src/sbh_81_runtime_production_lifecycle_ui_promotion.js`
- 模块版本：`runtimeProductionLifecycleUiPromotion=1`
- 模块 SHA-256：`e0b815d071b6664067dbf0ffb35afa562d763103d13bbe8b4194633e66d6aa30`
- 模块字节数：`64830`
- 测试入口：`SingBoxHub_Stage54_生产生命周期UI提升.txt`
- 入口版本：`81`
- 入口 SHA-256：`60c9a388e6bbf620e3249f5fa7d6255796e3b33975ec2a43f9e12fd9d2dee443`
- 入口字节数：`87059`
- 模块集：`20260803.22+stage54-production-lifecycle-ui-promotion-inline`

## 提升门禁

用户在节点页面点击“校验并启用生产生命周期控制”后，重新验证：

1. ShortX Shell uid 为 `0`；
2. Runtime、config、state、logs、control 和工作目录类型有效；
3. state 为 `0700`、root 所有；
4. Runtime JAR、生产 sing-box 二进制及生产配置存在且类型有效；
5. 生产配置为 `0600`、root 所有；
6. staging 恰好一个，生产配置与 staging 的 SHA-256 和字节数一致；
7. `sing-box check` 返回 `0`；
8. 控制服务恢复审计为 `0600`、root 所有；
9. 生命周期审计为 `0600`、root 所有，并包含 Stage 53 Retry 4 授权 ID及 `finalCoreState=stopped`；
10. endpoint canonical、`0600`、root 所有；
11. Runtime PID 存活，cmdline 和 uid/gid 验证通过；
12. 控制器持有 Core 数量不超过 `1`；
13. 宽松 Core 候选数量必须等于控制器持有数量，拒绝孤立或身份不明的生产 Core；
14. `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空；
15. 认证 `STATUS` 与 `/proc` 证据一致；
16. 提升时必须处于干净停止状态：Runtime 声称停止，控制器持有和宽松候选均为 `0`。

任一条件不满足时不提升，也不安装可用写操作状态。

## 控制器持有 Core 契约

生产 UI 采用真机确认的联合身份：

```text
PID != Runtime PID
PPid == Runtime PID
uid == 0
state != Z
argv0 == production sing-box binary
binary argument index == 0
production config exists at any later argument index
```

同时统计不要求 PPid 的宽松候选。宽松候选数量与控制器持有数量不一致时，状态标记为分歧，拒绝启动或停止。

## 首页生产控制

提升通过后，首页首屏替换为生产生命周期控制卡：

- `刷新`：执行精确 Shell 快照并发送一次认证 `STATUS`；
- `启动`：仅在干净停止状态发送一次认证 `START`；
- `停止`：仅在一致运行状态发送一次认证 `STOP_CORE`，停止态重复执行按幂等成功处理。

所有操作使用单一 `busy` 门禁串行执行，禁止并发点击导致交叉事务。

## 启动操作

1. 重新执行完整快照和 `STATUS`；
2. 要求 Runtime 停止，控制器持有和宽松候选均为 `0`；
3. 发送一次 `START`；
4. 最多等待 6 秒发现唯一 Core；
5. 验证 PPid、uid、argv0、binary/config 参数位置；
6. PID 在 4 秒稳定期前后必须一致；
7. Runtime 控制服务必须继续运行；
8. TUN、规则和路由必须继续为空。

启动后核验失败但已经锁定唯一控制器持有 Core 时，只通过 Runtime 发送一次 `STOP_CORE` 回滚；生产 UI 不发送直接系统进程信号。

## 停止操作

1. 重新执行完整快照和 `STATUS`；
2. 一致运行状态下发送一次 `STOP_CORE`；
3. 最多等待 6 秒，要求控制器持有和宽松候选均降为 `0`；
4. Runtime 控制服务必须继续运行；
5. 再发送一次 `STATUS`，要求停止；
6. 最终发送一次 `PING`，要求 `PONG`；
7. TUN、规则和路由必须继续为空。

已经处于一致停止状态时，不发送重复 `STOP_CORE`，仅复核 `STATUS` 和 `PING`。

## 提升审计

门禁通过后原子写入：

`state/production-lifecycle-ui-promotion.json`

权限：

- mode `0600`
- uid/gid `0/0`

审计包含 Stage、授权 ID、来源生命周期授权、Runtime PID、已安装动作和 `automaticCoreAction=false`，不包含 token、socketName、correlation、节点凭据或配置正文。

## UI 状态刷新

生产动作完成后：

- 更新模块内精确状态快照；
- 重新渲染当前页面；
- 调用既有只读 Runtime 刷新以同步顶部徽标；
- 不在页面构建或入口启动时自动执行 Core 操作。

## 写入与安全边界

提升门禁仅写入生产 UI 提升审计。后续启动和停止通过已认证 Runtime 控制服务完成。

明确禁止：

- 修改生产配置、staging 或备份；
- 创建 `sbh-tun0`；
- 修改规则 `8800–8815`；
- 修改路由表 `20240`；
- 修改 DNS 或防火墙；
- 执行节点连通性测试；
- 暴露 token、socketName 或 correlation；
- 使用 `pkill`、`killall` 或模糊 PID；
- 自动重试。

## 预期提升结果

```text
ok=true
stage=production_stage54_runtime_production_lifecycle_ui_promotion
preflightPassed=true
shellUid=0
productionConfigCheckPassed=true
lifecycleAuditVerified=true
lifecycleAuditFinalCoreState=stopped
controlServiceProcessAlive=true
controlServiceOwnerValidated=true
currentRuntimeStatus=STOPPED
currentCoreState=stopped
currentControllerOwnedCoreCount=0
currentLooseCoreCandidateCount=0
productionLifecycleUiPromoted=true
statusActionInstalled=true
startActionInstalled=true
stopActionInstalled=true
actionSerializationEnabled=true
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

## 静态验证

- 模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- 快照、启动观察、停止观察和提升审计四组生成 Shell 的 `sh -n`：通过；
- 入口内嵌源码 SHA-256 与仓库模块一致；
- 真机验证：待执行。
