# Runtime Stage 51：Core 状态与精确停止控制

## 输入门禁

Stage 50 Retry 3 真机已确认：

- Core PID `1085` 存活；
- 进程 argv、uid 和状态通过；
- 精确匹配 Core 数量为 `1`；
- 活动 PID 与元数据已发布；
- 生产配置与 staging 血缘通过；
- 未创建 TUN，未修改规则或路由；
- `nextAuthorizedOperation=runtime_core_status_and_exact_stop_control`。

## 授权边界

- 只读状态诊断 ID：`stage51-runtime-core-status-readonly-20260804`
- 精确停止授权 ID：`stage51-runtime-core-exact-stop-user-authorized-20260804`
- 来源启动授权 ID：`stage50-retry3-runtime-core-start-probe-user-authorized-20260804`
- 自动重试：禁用
- 启动新 Core：禁用
- TUN、路由、DNS、防火墙和连通性测试：禁用

状态按钮不消费停止授权。只有用户点击“精确停止本次 Core”时才执行停止事务。

## 实现

新增：

- `src/sbh_72_runtime_core_status_exact_stop.js`
- 模块内部版本：`runtimeCoreStatusExactStop=1`
- 完整嵌入源码 SHA-256：`2dfefecea3e87e1a10f1293a51954a6ee2e908244fc3ae02a503c8eb54883832`
- 仓库包装模块 SHA-256：`4abe99eaba2f0cb16cfbe858f223386f0ab9f6b2ff2463c26da53936b5fc7254`
- 测试入口版本：`72`
- 测试入口 SHA-256：`dd237f06a6354ba969658da1e90116e421c1b252c6032934e35c61fc89b9f65e`

仓库模块使用自包含 GZIP 包装，在内存中解压并执行完整 Rhino ES5 源码，不写临时源码，不访问网络。

## 只读状态检查

“检查 Core 精确状态”重新验证：

1. Runtime、`config`、`state`、`state/core-probes`、`logs` 类型与元数据；
2. 生产配置为 `0600`、root 所有；
3. staging 恰好一个，且生产配置与 staging 哈希和字节数一致；
4. `sing-box check` 返回 `0`；
5. `core-probe-active.pid` 和 `core-probe-active.json` 均为 `0600`、root 所有的普通文件；
6. PID 文件为纯数字；
7. 活动元数据 schema、stage、PID、来源授权、配置哈希、相对配置路径和 `outbound_only_probe` 模式一致；
8. 元数据日志相对路径满足固定模式，日志为 `0600`、root 所有，大小不超过 1 MiB；
9. PID 存活，argv 精确匹配生产二进制、`run`、`-c` 与生产配置；
10. uid 为 `0`，进程不是僵尸，精确匹配 Core 数量为 `1`；
11. 日志无受控 fatal 关键词；
12. `sbh-tun0`、规则 `8800–8815`、路由表 `20240` 均为空；
13. 恰好一个 Stage 50 事务 PID 文件指向该 PID。

状态检查不创建、修改或删除文件，不发送信号。

## 精确停止事务

“精确停止本次 Core”在重新执行全部身份门禁后：

1. 要求精确匹配 Core 数量为 `1`；
2. 要求网络资源仍为空；
3. 要求恰好一个事务 PID 文件绑定活动 PID；
4. 仅向活动 PID 发送 `SIGTERM`；
5. 最多等待 `5` 秒；
6. 若仍存活，仅在 argv 再次精确匹配时发送 `SIGKILL`；
7. 最多再等待 `2` 秒；
8. PID 身份发生变化时立即停止，不向新身份发送信号；
9. 要求精确匹配 Core 数量降为 `0`；
10. 要求 TUN、规则和路由仍为空；
11. 删除活动 PID、活动元数据和对应事务 PID 文件；
12. 原子写入 `state/core-probe-last-stop.json`，权限 `0600`、root 所有；
13. 保留生产配置、staging 和 Core 日志。

## 安全边界

- 禁止 `pkill`、`killall` 和模糊进程名终止；
- 不停止控制服务；
- 不启动新的 Core；
- 不删除 Core 日志；
- 不修改生产配置或 staging；
- 不创建或删除 TUN；
- 不修改路由、规则、DNS 或防火墙；
- 不产生代理网络流量；
- 不自动重试。

## 预期状态结果

```text
ok=true
processAlive=true
processIdentityValidated=true
processOwnerUid=0
matchingCoreCount=1
fatalLogSignalDetected=false
transactionPidRecordCount=1
tunInterfacePresent=false
reservedIpv4RuleCount=0
reservedIpv6RuleCount=0
reservedIpv4RouteCount=0
reservedIpv6RouteCount=0
exactStopReady=true
nextAuthorizedOperation=runtime_core_exact_stop
```

## 预期停止结果

```text
ok=true
exactTermSignalSent=true
processExited=true
matchingCoreCountBefore=1
matchingCoreCountAfter=0
activeRecordsRemoved=true
stopAuditCreated=true
tunInterfaceAfter=false
reservedIpv4RuleCountAfter=0
reservedIpv6RuleCountAfter=0
reservedIpv4RouteCountAfter=0
reservedIpv6RouteCountAfter=0
coreStopped=true
readyForProductionLifecycleIntegration=true
nextAuthorizedOperation=runtime_core_lifecycle_control_integration
```

## 当前状态

- Stage 50 Retry 3 真机通过记录：已提交；
- Stage 51 模块：已提交；
- 静态 JavaScript 语法检查：通过；
- 生成状态与停止 Shell 的 `sh -n`：通过；
- 真机状态与停止验证：待执行。
