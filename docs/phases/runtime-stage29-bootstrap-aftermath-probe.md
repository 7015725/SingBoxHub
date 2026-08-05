# Runtime 阶段 29：启动失败后的只读事后探测

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.26`
- 入口最低版本：`26`
- 模块数量：`29`
- 新模块：`src/sbh_29_runtime_bootstrap_aftermath_probe.js`
- 模块内部版本：`runtimeBootstrapAftermathProbe = 1`
- 模块 SHA-256：`bb522534e89e66f65cbdc4d7c37acd8d7db40509d6c8216c644e708c83aef6a8`
- 状态：实现完成，真机只读验证待执行

## 1. 输入结果

第 28 阶段真机返回：

```json
{
  "state": "control_service_bootstrap_failed",
  "authorizationConsumed": true,
  "staleEndpointDetected": true,
  "staleEndpointReplaced": false,
  "startupAttempted": true,
  "startupShellExitCode": 0,
  "startupShellErrorPresent": false,
  "startupResult": "",
  "startupRollbackAttempted": false,
  "controlServiceStarted": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "errorCode": "CONTROL_SERVICE_START_FAILED"
}
```

第 28 阶段从开始到结果约为 12.14 秒，与外层 Shell 的 12 秒预算一致。前置输出已经确认 root Shell、旧 endpoint 存在且核心进程不存在，但终态 `result`、PID、ready 或 rollback 均未返回。

因此不能把 `controlServiceStarted=false` 解释为设备上绝对没有启动过控制服务；它只表示第 28 模块没有收到足够证据确认启动成功。

## 2. 阶段目标

在不消费新启动授权的前提下确认：

1. 是否仍有匹配 `CoreRuntimeMain + runtime-tun.json + work` 的控制服务进程；
2. 当前 endpoint PID 是否存活并匹配控制服务；
3. endpoint 是否仍为旧 PID；
4. 是否残留 `runtime.*.pid`、`runtime.*.ready` 或临时 endpoint；
5. Runtime 日志在第 28 阶段附近是否发生变化；
6. 日志尾部是否包含类加载、依赖、权限、DEX 校验或安全错误信号。

## 3. 实现边界

第 29 模块只执行一个短时 root Shell 只读探测：

```json
{
  "endpointTokenRead": false,
  "socketNameRead": false,
  "socketConnectionAttempted": false,
  "requestSent": false,
  "processStarted": false,
  "processStopped": false,
  "filesModified": false,
  "runtimeControllerInvoked": false,
  "singBoxCoreStarted": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false
}
```

日志只在 Shell 内部进行错误关键词分类，不返回日志原文、token、socketName 或完整命令行。

## 4. 结果分类

模块会输出以下 `likelyFailurePoint` 之一：

```text
CONTROL_SERVICE_STARTED_STAGE28_REPORT_TIMED_OUT
CONTROL_SERVICE_STARTED_ENDPOINT_NOT_PUBLISHED
LAUNCH_ARTIFACTS_REMAIN_PROCESS_NOT_ALIVE
CONTROL_SERVICE_CLASS_LOAD_FAILED
CONTROL_SERVICE_DEPENDENCY_LOAD_FAILED
CONTROL_SERVICE_PERMISSION_DENIED
CONTROL_SERVICE_DEX_VERIFY_FAILED
CONTROL_SERVICE_SECURITY_FAILURE
CONTROL_SERVICE_EXITED_BEFORE_READY_OR_REPORT
STAGE28_LAUNCH_TRANSACTION_TIMED_OUT_WITHOUT_TERMINAL_RESULT
```

## 5. 后续修复方向

下一次真正启动重试不会复用第 28 阶段的单段长 Shell。固定改为：

1. 短事务预检；
2. 独立启动事务，立即返回 PID；
3. 独立只读 readiness/endpoint 探测；
4. 身份校验通过后再执行一次 PING；
5. 保持一次授权、一次请求、不自动重试。

是否需要停止第 28 阶段可能遗留的控制服务，必须先由本阶段真机结果确认，不能提前执行。