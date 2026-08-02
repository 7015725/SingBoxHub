# Runtime 阶段 28：真机启动器等待超时结论

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.25`
- 入口版本：`25`
- 对应模块：`src/sbh_28_runtime_control_service_bootstrap_ping.js`
- 状态：真机已执行；控制服务启动结果未完成；未发送 PING

## 1. 真机结果

```json
{
  "runtimeControlServiceBootstrapPing": "control_service_bootstrap_failed",
  "authorizationConsumed": true,
  "automaticRetryAllowed": false,
  "staleEndpointDetected": true,
  "staleEndpointReplaced": false,
  "startupAttempted": true,
  "startupShellExitCode": 0,
  "startupShellErrorPresent": false,
  "startupResult": "",
  "startupRollbackAttempted": false,
  "controlServiceStarted": false,
  "controlServicePid": null,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "runtimeFilesModified": false,
  "errorCode": "CONTROL_SERVICE_START_FAILED"
}
```

顶层运行耗时约 45.36 秒；第 28 模块从调用到返回约 12 秒后没有收到 `result=STARTED`。

## 2. 根因

首版启动脚本采用：

```sh
(
  nohup app_process ... &
  PID="$!"
  # 写 PID 文件
) &
wait "$!"
```

外层等待的是包含长期控制服务子进程的后台启动器。该启动器没有按预期快速退出，导致最外层 `toybox timeout 12` 截断命令。ShortX 返回的 shellCode 为 0，但 stdout 只包含前置字段，没有最终 `result` 字段，因此上层只能得到 `CONTROL_SERVICE_START_FAILED`。

该结论与以下证据一致：

- `startupResult` 为空；
- `startupShellErrorPresent=false`；
- 耗时接近固定 12 秒超时；
- 没有进入 endpoint、身份校验和 LocalSocket 阶段。

## 3. 安全结果

```json
{
  "tokenValueRead": false,
  "socketNameValueRead": false,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "socketConnected": false,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false
}
```

结果不能证明没有遗留控制服务进程，因为超时发生时后台 `app_process` 可能已经启动。因此下一次执行必须先检查匹配的 `CoreRuntimeMain` 进程，而不能直接再启动一个服务。

## 4. 修复门禁

Retry 1 必须：

1. 不再使用后台子 shell 加 `wait`；
2. 直接启动 `toybox nohup app_process ... &`，立即保存 `$!`；
3. 若已有存活服务且 endpoint 指向它，复用该服务；
4. 若只有一个 endpoint 未绑定的遗留服务，仅清理该控制服务后重新启动；
5. 若存在多个匹配服务，安全终止并返回错误，不自动清理；
6. 继续禁止 sing-box 核心、TUN、路由和配置操作；
7. 最多发送一次固定 `PING`。

Retry 1 由 `entry/SingBoxHubRuntimeControlRetry1.js` 实现。