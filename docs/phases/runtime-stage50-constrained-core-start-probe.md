# Runtime Stage 50：受限 Core 启动探测与精确失败回滚

## 授权

用户在 Stage 49 真机通过后回复“下一阶段”，本阶段将其解释为对以下单次、手动操作的明确授权：

- 授权 ID：`stage50-runtime-core-start-probe-user-authorized-20260804`
- 自动重试：禁用
- 使用当前已验证生产配置启动 sing-box Core：启用
- 成功后保留本次 Core 运行：启用
- 失败时精确停止本次启动进程：启用
- TUN、路由、DNS、防火墙和连通性测试：禁用

该授权不包含日常启停控制，也不包含代理网络连通性验证。

## 输入证据

Stage 49 真机结果已经确认：

- `ok=true`
- `productionConfigHashMatchesCandidate=true`
- `productionConfigCheckPassed=true`
- `productionConfigMode=600`
- `productionConfigUid=0`
- `productionConfigGid=0`
- `backupCreated=true`
- `auditRecordCreated=true`
- `runningCoreCount=0`
- `readyForExplicitCoreStartProbe=true`
- `nextAuthorizedOperation=runtime_core_start_probe_with_exact_rollback`

当前生产配置 SHA-256：

`35ae10caf0bbb70fed6a10bffae2d782a029c0c18cd0823ce124b4fea5d4da09`

当前配置来自 Stage 43 候选 outbound 集、Stage 45 selector 注入、Stage 48 staging 和 Stage 49 原子提升链。该配置不包含本阶段主动创建的 TUN、路由或防火墙操作。

## 实现

新增 `src/sbh_68_runtime_core_start_probe.js`：

- 模块内部版本：`runtimeCoreStartProbe = 1`
- 完整嵌入源码 SHA-256：`d54eb4e7b8df97b21ccc25075b1705f9a5a94b870d52b0d770658b4e5a830e07`
- 仓库模块采用自包含 GZIP 嵌入方式，运行时仅在内存中解压并执行完整 Rhino ES5 源码；不访问网络、不写临时源码。

## 三段事务

### 1. 精确前置门禁

Root ShortX Shell 重新验证：

1. Runtime、`config`、`state`、`logs` 和探测目录均为普通目录，不是符号链接；
2. `runtime-tun.json` 和 sing-box 二进制均为普通文件；
3. 生产配置为 `0600`、uid 0、gid 0；
4. Stage 48 staging 恰好存在一个；
5. 生产配置与 staging 的 SHA-256 和字节数一致；
6. `sing-box check` 再次通过；
7. 没有当前活动探测 PID 或活动元数据；
8. 没有精确匹配该二进制和配置路径的现有 Core；
9. `sbh-tun0` 不存在；
10. IPv4/IPv6 规则优先级 `8800–8815` 均为空；
11. IPv4/IPv6 路由表 `20240` 均为空。

任一条件不满足时不启动 Core。

### 2. 双 setsid 派发

启动使用：

```sh
toybox setsid toybox setsid -d /system/bin/sh -c '<inner launcher>' ...
```

内层启动器：

1. 将自身精确 PID 原子写入本次事务 PID 文件；
2. PID 文件固定为 `0600`、root 所有；
3. 使用 `exec` 替换为：

```sh
<runtime>/bin/sing-box run -c <runtime>/config/runtime-tun.json
```

4. 标准输出和错误仅写入本次 0600 探测日志。

不使用 `pkill`、`killall` 或模糊进程名称。

### 3. 已知 PID 复核

复核仅接受本次事务 PID 文件中的 PID，并要求 `/proc/<pid>/cmdline` 精确匹配：

```text
argv[0] = sing-box 二进制绝对路径
argv[1] = run
argv[2] = -c
argv[3] = 生产配置绝对路径
```

随后验证：

- 进程 uid 为 0；
- 精确匹配 Core 数量为 1；
- 进程不处于 zombie 状态；
- 在 4 秒稳定窗口后仍存活且身份未变化；
- 生产配置哈希未变化；
- 日志为 `0600`、root 所有且不超过 1 MiB；
- 日志中没有 fatal、panic、配置失败、权限拒绝等终止信号；
- `sbh-tun0`、规则 `8800–8815`、路由表 `20240` 在启动前后均保持为空。

通过后原子发布：

```text
state/core-probe-active.pid
state/core-probe-active.json
```

活动元数据只记录 PID、配置哈希、日志相对文件名、授权 ID 和时间戳，不记录配置正文或凭据。

## 精确失败回滚

若派发后任一门禁失败：

1. 再次确认 PID 仍精确匹配本次二进制和配置；
2. 仅向该 PID 发送 `SIGTERM`；
3. 有限等待后仍存活才发送 `SIGKILL`；
4. 删除本次事务 PID、活动 PID 和活动元数据；
5. 保留已验证生产配置、Stage 48 staging、Stage 49 正式备份和审计记录；
6. 不清理任何未知进程或其他应用资源。

## 静态与隔离验证

已完成：

- Rhino ES5/JavaScript 语法检查通过；
- 禁止语法扫描通过；
- 三段生成 Shell 的 `sh -n` 检查通过；
- 隔离夹具成功路径通过：精确身份、活动状态发布、进程保持运行；
- 强制配置哈希变化路径通过：仅停止本次进程；
- 强制 fatal 日志路径通过：仅停止本次进程；
- 回滚路径确认先 TERM，必要时才 KILL。

以上不替代 Android 真机验证。

## 不执行的操作

- 不创建 TUN；
- 不修改路由、规则、DNS 或防火墙；
- 不执行节点连通性或流量测试；
- 不切换系统代理；
- 不停止其他 sing-box 或代理应用；
- 不修改生产配置；
- 不删除 Stage 49 备份；
- 不自动重试。

## 预期通过门禁

```text
ok=true
preflightPassed=true
stage49ProductionConfigLineageVerified=true
productionConfigCheckPassed=true
existingMatchingCoreCountBefore=0
processPidReturned=true
processAlive=true
processIdentityValidated=true
processOwnerUid=0
matchingCoreCountAfter=1
stabilizationPassed=true
fatalLogSignalDetected=false
activePidPublished=true
activeMetadataPublished=true
tunCreated=false
routeModified=false
reservedNetworkResourcesUnchanged=true
networkConnectivityTestInvoked=false
rollbackInvoked=false
coreRemainsRunning=true
readyForCoreStatusAndExactStopControl=true
nextAuthorizedOperation=runtime_core_status_and_exact_stop_control
```

## 发布与真机测试

测试入口版本：`68`

离线启动链：

- 校验并加载本地基础模块集 `20260803.22`；
- 内联加载 Stage 50 完整模块；
- 不读取远程 manifest；
- 不下载远程模块。

真机成功后 Core 会保持运行。不得再次点击 Stage 50 按钮；下一阶段必须读取活动 PID/元数据，执行状态复核和精确停止控制。

## 当前状态

- 实现：完成；
- 静态与隔离验证：通过；
- 真机验证：待执行；
- 下一阶段门禁：仅在 Stage 50 真机通过后开放 `runtime_core_status_and_exact_stop_control`。
