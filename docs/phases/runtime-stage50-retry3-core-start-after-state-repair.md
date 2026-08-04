# Runtime Stage 50 Retry 3：state 修复后的受限 Core 启动探测

## 授权

Stage 50 Retry 2 真机界面已经返回成功提示，且模块代码只在 `result.ok=true` 时显示该提示。由于完整按钮结果 JSON 未被保存，本阶段在真正启动 Core 前重新独立校验所有关键门禁。

本次单次授权：

- 授权 ID：`stage50-retry3-runtime-core-start-probe-user-authorized-20260804`
- 自动重试：禁用
- 受限启动当前生产 sing-box Core：启用
- 启动失败时精确停止本次进程：启用
- 成功后保留本次精确 PID：启用
- TUN、路由、DNS、防火墙与网络连通性测试：禁用

## 实现

新增模块：

- `src/sbh_71_runtime_core_start_probe_retry3.js`
- 模块内部版本：`runtimeCoreStartProbeRetry3=1`
- 模块 SHA-256：`a8e100a3aa290740d0996d86df137b89d86ce1e3deb0e8b240f463d13682dd25`
- 测试入口版本：`71`
- 测试入口 SHA-256：`936535e8d79f61962067e104fd425656c1df30c32d28c6f792a495603b7ce124`

## 前置门禁

Core 派发前重新验证：

1. root ShortX Shell；
2. Runtime 根目录与 `config`、`logs` 目录类型；
3. 已修复的 `Runtime/state`：
   - 普通目录；
   - 非符号链接；
   - mode `0700`；
   - uid/gid `0/0`；
4. `config/runtime-tun.json` 为普通文件，mode `0600`、uid/gid `0/0`；
5. sing-box 二进制为可执行普通文件；
6. staging 恰好存在一个且为普通文件；
7. 生产配置与 staging 的 SHA-256 和字节数一致；
8. `sing-box check` 返回 0；
9. 本次事务 PID、临时 PID 和日志路径不存在；
10. 活动 PID 和活动元数据不存在；
11. 精确匹配生产二进制与配置路径的 Core 数量为 0；
12. `sbh-tun0` 不存在；
13. IPv4/IPv6 规则优先级 `8800–8815` 均为空；
14. IPv4/IPv6 路由表 `20240` 均为空。

任一门禁失败时不派发 Core。

## 启动事务

使用双 `setsid` 派发：

```text
toybox setsid toybox setsid -d /system/bin/sh -c ...
```

内层启动器：

1. 将自身 PID 写入本次事务临时 PID 文件；
2. 设置 `0600`、root 所有；
3. 原子移动为正式事务 PID 文件；
4. `exec` 为：

```text
sing-box run -c config/runtime-tun.json
```

日志写入本次受限探测日志，mode 为 `0600`、root 所有。

## 稳定与身份复核

启动后只接受满足全部条件的进程：

- PID 来自本次事务 PID 文件；
- PID 存活；
- argv 精确匹配生产二进制、`run`、`-c` 和生产配置路径；
- uid 为 0；
- 精确匹配 Core 数量为 1；
- 连续稳定检查通过；
- 进程非 zombie；
- 日志文件类型、mode、所有权和大小满足限制；
- 日志未命中 panic、fatal、权限拒绝、端口占用、启动失败或配置无效信号；
- 生产配置哈希未变化；
- `sbh-tun0`、预留规则与路由表仍为空。

成功后原子发布：

```text
state/core-probe-active.pid
state/core-probe-active.json
```

## 精确失败回滚

派发后的任一门禁失败时：

1. 只读取本次事务 PID；
2. 再次验证 PID 的完整 argv 身份；
3. 仅对身份匹配的本次进程发送 SIGTERM；
4. 短时等待后仍存活且身份仍匹配时发送 SIGKILL；
5. 清理本次临时 PID 和本次发布的活动状态；
6. 不使用 `pkill`、`killall` 或模糊进程名称；
7. 不恢复或修改已经通过 Stage 49 提升的生产配置。

## 不执行的操作

- 不创建 `sbh-tun0`；
- 不修改路由表 `20240`；
- 不修改规则 `8800–8815`；
- 不修改 DNS 或防火墙；
- 不执行节点连通性测试；
- 不主动生成代理流量；
- 不自动重试。

## 预期通过结果

```text
ok=true
stage=production_stage50_retry3_runtime_core_start_probe
preflightPassed=true
stateDirectoryRepairVerified=true
stateDirectoryMode=700
stateDirectoryUid=0
stateDirectoryGid=0
stage49ProductionConfigLineageVerified=true
productionConfigCheckPassed=true
existingMatchingCoreCountBefore=0
dispatchCompletionMarkerObserved=true
processPidReturned=true
processAlive=true
processIdentityValidated=true
processOwnerUid=0
matchingCoreCountAfter=1
stabilizationPassed=true
fatalLogSignalDetected=false
activePidPublished=true
activeMetadataPublished=true
reservedNetworkResourcesUnchanged=true
rollbackInvoked=false
coreRemainsRunning=true
readyForCoreStatusAndExactStopControl=true
nextAuthorizedOperation=runtime_core_status_and_exact_stop_control
```

## 当前状态

- Retry 2 有界真机结果：已记录；
- Retry 3 实现：完成；
- Rhino ES5/JavaScript 语法检查：通过；
- 真机验证：待执行；
- 成功后不得重复运行该入口，应进入 Core 状态读取与精确停止阶段。
