# Runtime Stage 57：低延迟生产生命周期控制

## 输入状态

Stage 56 已确认：

- Runtime 控制服务 PID `19373` 正常；
- 手动 `START` 与 `STOP_CORE` 功能闭环通过；
- Core 启动 PID `32571`，停止后数量恢复为 `0`；
- TUN、规则和路由保持为空；
- 但单次启动或停止的同步等待接近或超过 60 秒。

## 授权与入口

- 授权 ID：`stage57-runtime-production-lifecycle-low-latency-user-authorized-20260806`
- 来源 Stage 56 授权：`stage56-runtime-production-lifecycle-write-unlock-user-authorized-20260805`
- 测试入口：`SingBoxHub_Stage57_低延迟生命周期控制.txt`
- 入口版本：`84`
- 入口 SHA-256：`67669a84d304d62f0f5d6c4124bfb622e17f9b3abbbfbf7f596fd55ef29f0315`
- 入口字节数：`40813`
- 内嵌包装模块：`sbh_84_runtime_production_lifecycle_low_latency.js`
- 包装模块 SHA-256：`c170e32c63e7e3aef5ffba56b16edaa7cdf7ce84133fad79fe3defe777d4e4ab`
- 原始模块 SHA-256：`ac3c6fea60fca9e25896c3957945c0b5e16b2b9e22107f3ee8cef72be167163c`
- 原始模块字节数：`80963`
- 模块集：`20260803.22+stage57-low-latency-lifecycle-inline`

## 核心变化

Stage 56 的 UI 回调等待三次左右的 ShellCommand 完成。Stage 57 将单次写操作拆成两个阶段：

```text
可见快速路径
    START / STOP_CORE
    STATUS 250ms 轮询
    UI 立即更新

后台严格路径
    单次 root Shell
    配置哈希 + Runtime/Core 身份
    TUN/规则/路由
    操作审计
```

### 可见路径

- Shell 调用：`0`
- 仅使用已认证 Android `LocalSocket`
- `STATUS` 轮询间隔：`250 ms`
- 状态收敛上限：`6000 ms`
- 目标可见完成：`<= 5000 ms`

### 后台严格路径

每次成功写操作只执行一次 ShellCommand，并在同一命令中完成：

- 生产配置 SHA-256 与字节数和激活基线一致；
- Runtime 控制服务 PID、cmdline 与 root 所有权；
- 控制器持有 Core 身份和宽松候选计数；
- `sbh-tun0`；
- IPv4/IPv6 规则 `8800–8815`；
- IPv4/IPv6 路由表 `20240`；
- `state/production-lifecycle-last-operation.json` 原子审计。

后台核验期间下一次写操作保持锁定，但首页状态已先完成更新。

## 启用门禁

进入节点页点击“校验并启用低延迟控制”时执行一次严格 Shell 门禁：

1. root uid；
2. Runtime、state、control、work、JAR、二进制和配置类型；
3. state `0700/root`；
4. 生产配置 `0600/root`；
5. staging 恰好一个，配置哈希和字节数一致；
6. `sing-box check` 通过；
7. Stage 56 解锁审计存在且授权匹配；
8. canonical endpoint 和 Runtime PID 身份；
9. Core 当前为停止，控制器持有与宽松候选均为 `0`；
10. TUN、规则、路由为空；
11. 写入 `state/production-lifecycle-low-latency.json`。

启用门禁本身仍可能受 ShortX Shell 传输延迟影响，但只执行一次。

## 启动快速路径

1. 要求当前状态为 `stopped`；
2. 发送一次 `START`，要求响应 `STARTED`；
3. 每 250 ms 发送 `STATUS`，直到 `RUNNING` 或 6 秒超时；
4. 立即更新首页为运行中，并显示 `visibleCompletionDurationMs`；
5. 后台启动一次严格核验；
6. 核验通过后补充 Core PID、PPid、uid、参数索引和严格耗时。

启动后台核验失败时：

- 只发送一次认证 `STOP_CORE`；
- 轮询到 `STOPPED`；
- 锁定低延迟控制，要求重新执行 Stage 57 门禁；
- 不发送 TERM/KILL。

## 停止快速路径

1. 要求当前状态为 `running`；
2. 发送一次 `STOP_CORE`；
3. 每 250 ms 发送 `STATUS`，直到 `STOPPED` 或 6 秒超时；
4. 立即更新首页为已停止；
5. 后台执行一次严格零 Core、网络资源和审计核验。

## 性能字段

快速结果：

```text
commandDurationMs
statusConvergenceMs
visibleCompletionDurationMs
visiblePathShellCalls=0
strictVerificationScheduled=true
```

后台结果：

```text
strictVerificationDurationMs
totalDurationMs
strictBackgroundShellCalls=1
strictVerificationPassed=true
performanceTargetVisibleUnderFiveSeconds
```

首页直接显示“可见耗时 / 严格核验耗时”。

## 安全边界

- 自动重试：禁用；
- 系统进程信号：禁用；
- `pkill` / `killall`：禁用；
- TUN、规则、路由、DNS、防火墙写入：禁用；
- 节点连通性测试：禁用；
- token、socketName、correlation 和配置正文：不显示、不写审计；
- 后台核验失败后：锁定控制。

## 真机测试顺序

1. Core 保持停止状态；
2. 运行 Stage 57 入口；
3. 节点页点击一次“校验并启用低延迟控制”；
4. 返回首页点击一次“刷新”，记录耗时；
5. 点击一次“启动”，记录界面切换到运行中的耗时；
6. 等待“后台严格核验通过”；
7. 点击一次“停止”，记录界面切换到已停止的耗时；
8. 等待后台严格核验通过；
9. 在节点页截取最近完整性能 JSON。

后台核验未结束前不要重复点击启动或停止。

## 预期门禁结果

```text
ok=true
lowLatencyControlEnabled=true
visiblePathShellCalls=0
strictBackgroundShellCallsPerWrite=1
statusControlUsesLocalSocketOnly=true
startVisiblePathUsesLocalSocketOnly=true
stopVisiblePathUsesLocalSocketOnly=true
currentRuntimeStatus=STOPPED
currentCoreState=stopped
readyForLowLatencyManualControlTest=true
```

## 预期启动性能结果

```text
operation=start
phase=visible_complete
responseStatus=STARTED
finalRuntimeStatus=RUNNING
visibleCompletionDurationMs<=5000
visiblePathShellCalls=0
strictVerificationScheduled=true
```

随后：

```text
operation=start
phase=strict_verified
strictVerificationPassed=true
corePid>1
finalCoreState=running
strictBackgroundShellCalls=1
```

## 预期停止性能结果

```text
operation=stop
phase=visible_complete
finalRuntimeStatus=STOPPED
visibleCompletionDurationMs<=5000
visiblePathShellCalls=0
strictVerificationScheduled=true
```

随后：

```text
operation=stop
phase=strict_verified
strictVerificationPassed=true
finalCoreState=stopped
controlServiceRemainsRunning=true
reservedNetworkResourcesUnchanged=true
```

## 静态验证

- 原始模块 JavaScript 语法：通过；
- 包装模块 JavaScript 语法：通过；
- 完整入口 JavaScript 语法：通过；
- activation、start verify、stop verify 三组 Shell `sh -n`：通过；
- 入口内嵌包装模块 SHA-256 与声明一致；
- 包装模块解压后 SHA-256 与原始模块一致；
- 真机验证：待执行。
