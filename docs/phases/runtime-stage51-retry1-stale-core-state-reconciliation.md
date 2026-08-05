# Runtime Stage 51 Retry 1：失效 Core 状态精确核对

## 授权

Stage 51 真机结果明确返回：

- `blockingGate=core_process_not_alive`
- `diagnosticCode=430`
- `nextAuthorizedOperation=reconcile_active_core_probe_state`

本阶段仅授权核对并清理 Stage 50 Retry 3 遗留的失效活动记录：

- 授权 ID：`stage51-retry1-stale-core-state-reconcile-user-authorized-20260804`
- 来源启动授权 ID：`stage50-retry3-runtime-core-start-probe-user-authorized-20260804`
- 自动重试：禁用
- 进程信号：禁用
- Core 启动/停止：禁用
- 配置、staging 和日志修改：禁用
- TUN、路由、DNS、防火墙：禁用

## 实现

新增模块：

- `src/sbh_73_runtime_core_stale_state_reconcile.js`
- 模块内部版本：`runtimeCoreStaleStateReconcile=1`
- 模块 SHA-256：`9286ab5905a350962c3e9502c4b6eb91a1b0b222d4fe23ee1bf31d1f9f328243`
- 测试入口版本：`73`
- 测试入口 SHA-256：`6d53ff907fb9bdc2d4689bfb028cde3ed06426a78e40499fb956745feaf7f6e2`

## 精确前置门禁

执行任何删除前重新验证：

1. root ShortX Shell；
2. Runtime、`config`、`state`、`state/core-probes`、`logs` 均为普通目录且非符号链接；
3. `state` 权限为 `0700`、uid/gid 为 `0/0`；
4. 生产配置为普通文件、`0600`、uid/gid 为 `0/0`；
5. sing-box 二进制为可执行普通文件；
6. staging 恰好一个，生产配置与 staging 的 SHA-256 和字节数一致；
7. `sing-box check` 返回 `0`；
8. 活动 PID 和活动元数据为 `0600`、root 所有的普通文件；
9. 元数据 schema、stage、PID、授权 ID、配置哈希、相对配置路径、模式及日志路径与 Stage 50 Retry 3 完全一致；
10. Core 日志为 `0600`、root 所有，大小不超过 1 MiB；
11. 活动记录 PID 当前不存活；
12. 系统中精确匹配生产二进制与配置路径的 Core 数量为 `0`；
13. `sbh-tun0` 不存在；
14. IPv4/IPv6 规则 `8800–8815` 和路由表 `20240` 均为空；
15. `state/core-probes` 中恰好存在一个事务 PID 文件，且内容等于活动 PID。

任一条件不满足时不删除任何记录。

## 允许写入范围

通过全部门禁后只允许：

- 删除 `state/core-probe-active.pid`；
- 删除 `state/core-probe-active.json`；
- 删除唯一匹配的 `state/core-probes/core-start-*.pid`；
- 原子写入 `state/core-probe-last-reconcile.json`，权限 `0600`、root 所有。

Core 日志、生产配置、staging 和正式备份全部保留。

## 控制服务状态

核对事务只读检查 `cache/control_endpoint.json` 中记录的控制服务 PID：

- 不读取或返回 token；
- 不连接 LocalSocket；
- 不启动控制服务；
- 仅返回 `controlServiceAlive` 和 `controlServiceRecoveryRequired`。

如果失效 Core 记录清理成功且控制服务仍未存活，下一门禁为：

`runtime_control_service_recovery_before_lifecycle_integration`

## 预期通过结果

```text
ok=true
staleProcessAlive=false
matchingCoreCountBefore=0
matchingCoreCountAfter=0
transactionPidRecordCount=1
staleActiveRecordsRemoved=true
reconcileAuditCreated=true
tunInterfaceBefore=false
tunInterfaceAfter=false
reservedIpv4RuleCountAfter=0
reservedIpv6RuleCountAfter=0
reservedIpv4RouteCountAfter=0
reservedIpv6RouteCountAfter=0
processSignalSent=false
coreStartInvoked=false
coreStopInvoked=false
controlServiceRecoveryRequired=true
readyForControlServiceRecovery=true
nextAuthorizedOperation=runtime_control_service_recovery_before_lifecycle_integration
```

## 验证

- Rhino ES5/JavaScript 语法检查：通过；
- 测试入口 JavaScript 语法检查：通过；
- 生成 Shell 的 `sh -n`：通过；
- 内联源码 SHA-256 与入口声明一致；
- 真机验证：待执行。
