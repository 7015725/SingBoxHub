# Runtime Stage 52：控制服务恢复与一次认证 PING

## 输入门禁

Stage 51 Retry 1 真机已确认：

- 失效 Core PID `1085` 不存活；
- 系统中精确匹配 Core 数量为 `0`；
- 失效活动记录已删除；
- `state/core-probe-last-reconcile.json` 已创建；
- 生产配置与 staging 血缘和 `sing-box check` 通过；
- `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空；
- 控制服务未运行；
- `nextAuthorizedOperation=runtime_control_service_recovery_before_lifecycle_integration`。

## 授权边界

- 授权 ID：`stage52-runtime-control-service-recovery-user-authorized-20260805`
- 来源核对授权 ID：`stage51-retry1-stale-core-state-reconcile-user-authorized-20260804`
- 自动重试：禁用
- Runtime 控制服务恢复：启用
- 认证 PING：最多一次
- sing-box Core 启动/停止：禁用
- TUN、规则、路由、DNS、防火墙：禁用
- 节点连通性测试和代理流量：禁用

## 实现

新增：

- `src/sbh_74_runtime_control_service_recovery.js`
- 完整嵌入源码 SHA-256：`33964c5cb86e4fa7cf3a37988115febd8d124ecfe498284ce458454734ed9403`
- 仓库 GZIP 包装模块 SHA-256：`eae186ad25ae8b53aed744865cdf8177e8a5875137bc02e6696a5e861a0b3eac`
- 测试入口下载文件：`SingBoxHub_Stage52_Runtime控制服务恢复.txt`
- 入口版本：`74`
- 测试入口 SHA-256：`65456608c8824fdbb0529a0955815dc88d8bf92566f88ff413ede224074cc545`
- 本地模块集：`20260803.22+stage52-control-service-recovery-inline`

仓库模块使用自包含 GZIP 包装，在内存中解压并执行完整 Rhino ES5 源码，不写临时源码，不访问网络。

## 前置门禁

执行启动或复用前重新验证：

1. root ShortX Shell；
2. Runtime、`config`、`state`、`state/core-probes`、`logs`、`runtime/control` 和工作目录类型；
3. `state` 为 `0700`、uid/gid 为 `0/0`；
4. `state/core-probe-last-reconcile.json` 为 `0600`、root 所有的普通文件；
5. 活动 Core PID、活动元数据和 Core 事务 PID 均不存在；
6. 生产配置为 `0600`、root 所有；
7. staging 恰好一个，生产配置和 staging 的 SHA-256、字节数一致；
8. `sing-box check` 返回 `0`；
9. 精确匹配 sing-box Core 数量为 `0`；
10. `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空；
11. Runtime JAR、sing-box 二进制、控制目录和工作目录有效。

任一门禁失败时不启动控制服务。

## endpoint 与服务复用

canonical endpoint：

`runtime/control/control_endpoint.json`

若 endpoint 存在，必须满足：

- 普通文件且非符号链接；
- mode `0600`；
- uid/gid `0/0`；
- canonical 路径一致；
- `runtimePid` 为纯数字。

如果 PID 存活且 cmdline 同时匹配：

- `com.singboxhub.runtime.CoreRuntimeMain`
- 生产配置路径
- Runtime 工作目录

则复用现有服务并直接进入一次认证 PING。

如果 PID 不存活或身份不匹配，则将 endpoint 标记为 stale；只有新服务完成进程身份、ready 和 endpoint 门禁后，才通过原子重命名覆盖 stale endpoint。

控制服务候选只读取 `runtime/control/runtime.*.pid`，不使用模糊进程名终止。发现存活的孤立候选时安全拒绝，不重复启动。

## 双 setsid 启动

新服务使用：

```text
toybox setsid toybox setsid -d /system/bin/sh -c ...
```

内层启动器：

1. 将自身 PID 写入本次唯一事务 PID 临时文件；
2. 设置 `0600`、root 所有；
3. 原子移动为正式事务 PID 文件；
4. 设置 `CLASSPATH` 为 `SingBoxHubCoreRuntime.jar`；
5. `exec app_process64/app_process` 为 `CoreRuntimeMain`；
6. 参数仅包含新 socketName、随机 token、生产二进制、生产配置、工作目录和 ready 文件；
7. 日志追加到 `logs/runtime-production.log`。

## endpoint 与恢复审计

服务 ready 且身份验证通过后：

1. 通过同目录临时文件原子发布 endpoint；
2. endpoint 固定为 `0600`、root 所有；
3. 写入 `state/control-service-last-recovery.json`；
4. 恢复审计不包含 token、socketName 或 endpoint 原文；
5. 删除本次临时 PID 和 ready 文件。

## 认证 PING

客户端调用顺序固定为：

```text
LocalSocket()
connect(LocalSocketAddress)
setSoTimeout(2000)
```

不使用 Android 不支持的双参数 `connect` 重载。

最多发送一次：

```text
<token>\n
<one-shot correlation>\n
PING\n
```

只接受：

```text
PONG\n
<same correlation>\n
```

结果不返回 token、socketName、correlation 或 endpoint 原文。

## 精确失败回滚

仅当本阶段启动了新控制服务，且后续进程、endpoint、审计或 PING 门禁失败时：

1. 从本次事务得到精确 PID；
2. 再次验证 PID cmdline；
3. 只向该 PID 发送 `SIGTERM`；
4. 短时等待后仍存活且身份仍匹配时发送 `SIGKILL`；
5. 仅删除绑定该 PID 的 endpoint、恢复审计和本次临时文件。

复用旧服务时 PING 失败不会停止该服务。禁止 `pkill`、`killall` 和模糊进程匹配。

## 写入范围

仅允许：

- `runtime/control/control_endpoint.json`
- `runtime/control/runtime.*.pid`
- `runtime/control/runtime.*.ready`
- `runtime/control/.control_endpoint.*.tmp`
- `state/control-service-last-recovery.json`
- `state/.control-service-last-recovery.*.tmp`
- `logs/runtime-production.log`

生产配置、staging、正式备份和 Core 日志均不修改。

## 预期通过结果

```text
ok=true
preflightPassed=true
staleCoreReconcileAuditVerified=true
productionConfigCheckPassed=true
matchingCoreCountBefore=0
tunInterfacePresentBefore=false
orphanControlServiceCandidateCount=0
controlServicePid=<new-or-reused-pid>
controlServiceProcessAlive=true
controlServiceCommandValidated=true
controlServiceOwnerValidated=true
controlServiceRemainsRunning=true
endpointFileCanonical=true
endpointModeValidated=true
endpointOwnerValidated=true
endpointSchemaValidated=true
endpointContractReady=true
localSocketPublicConnectUsed=true
connectTimeoutOverloadUsed=false
socketReadTimeoutConfigured=true
socketConnected=true
requestSent=true
requestCount=1
responseStatus=PONG
responseStatusMatched=true
correlationMatched=true
rollbackInvoked=false
coreStartInvoked=false
coreStopInvoked=false
coreRunning=false
tunCreated=false
routeModified=false
readyForProductionLifecycleIntegration=true
nextAuthorizedOperation=runtime_core_lifecycle_control_integration
```

## 验证

- Node.js JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- `let`、`const`、箭头函数、`class`、模板字符串：不存在；
- 前置、派发、复核和回滚 Shell 的 `sh -n`：通过；
- GZIP 包装解压源码 SHA-256：一致；
- 真机验证：待执行。
