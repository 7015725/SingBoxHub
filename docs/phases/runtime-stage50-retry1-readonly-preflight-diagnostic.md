# Runtime Stage 50 Retry 1：只读前置门禁诊断

## 目标

Stage 50 首次真机执行返回：

- `CORE_START_PREFLIGHT_FAILED`
- `preflightCompletionMarkerObserved=false`
- `coreStartInvoked=false`

ShortX ShellAction 的 `shellCode=158` 不能映射到 Shell 内的 `exit 211–233`，因此本重试不再次启动 Core，而是重新执行只读诊断并返回首个阻断门禁。

## 实现

新增：

- `src/sbh_69_runtime_core_start_preflight_diagnostic.js`
- 内部版本：`runtimeCoreStartPreflightDiagnostic=1`
- 完整嵌入源码 SHA-256：`b7ebb789afac51d2659e5b2e0c6d9667ac9b0f3d4b278bffeed6795b928aee16`
- 测试入口版本：`69`

诊断重新读取以下状态：

1. Root Shell UID；
2. Runtime、配置、状态和日志目录类型；
3. `runtime-tun.json` 与 sing-box 二进制类型；
4. 生产配置 `0600`、uid 0、gid 0；
5. Stage 48 staging 数量和文件类型；
6. 生产配置与 staging 的 SHA-256、字节数一致性；
7. `sing-box check`；
8. `core-probe-active.json` 和 `core-probe-active.pid` 是否存在；
9. 活动 PID 文件格式、存活状态及精确 Core 身份；
10. 当前精确匹配生产二进制和配置路径的 Core 数量；
11. `sbh-tun0`；
12. IPv4/IPv6 规则 `8800–8815`；
13. IPv4/IPv6 路由表 `20240`。

输出 `blockingGate` 与 `likelyOriginalExitCode`，用于对应 Stage 50 原前置门禁。

## 与原 Stage 50 的差异

- 不使用早退式 `exit 211–233` 作为唯一诊断信号；
- 所有项目读取完成后统一输出：
  - `BLOCK`
  - `BLOCK_CODE`
  - `WOULD_PASS`
  - `DONE`
- 脚本最终固定 `exit 0`；
- `shellCode` 继续标记为非权威，完成标记和字段值才是判定依据。

## 安全边界

- `authorizationConsumed=false`
- 不创建 `state/core-probes`；
- 不创建、修改或删除 Runtime 文件；
- 不修改生产配置或 staging；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙；
- 不执行连通性测试；
- 不访问外部网络；
- 不自动重试。

## 静态与隔离验证

已完成：

- JavaScript 语法检查通过；
- Rhino ES5 约束检查通过；
- 生成 Shell 通过 `sh -n`；
- 隔离正常夹具返回：
  - `BLOCK=none`
  - `WOULD_PASS=1`
  - `DONE=1`
- 隔离陈旧 PID 夹具返回：
  - `BLOCK=stale_active_pid`
  - `BLOCK_CODE=231`
  - `WOULD_PASS=0`
  - `DONE=1`

## 预期结果

诊断本身成功时：

```json
{
  "ok": true,
  "completionMarkerObserved": true,
  "originalPreflightWouldPass": false,
  "blockingGate": "<具体门禁>",
  "likelyOriginalExitCode": 211,
  "coreStartInvoked": false,
  "runtimeFilesModified": false
}
```

如果所有前置条件当前均通过：

```json
{
  "ok": true,
  "originalPreflightWouldPass": true,
  "blockingGate": null,
  "readyForCorrectedStage50Retry": true,
  "nextAuthorizedOperation": "corrected_runtime_core_start_probe_retry"
}
```

## 下一阶段门禁

- 存在 `blockingGate`：先处理已识别门禁，不启动 Core；
- `blockingGate=null`：说明原 Stage 50 的早退报告链存在问题，下一阶段生成带明确前置结果封装的修正版 Core 启动入口；
- 未收到新的明确授权前，禁止再次启动 Core。
