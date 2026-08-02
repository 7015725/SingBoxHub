# Runtime 阶段 28：真机启动事务超时结果

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.25`
- 入口版本：`25`
- 状态：真机已执行；启动事务未返回终态；未执行 Socket PING

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
  "errorCode": "CONTROL_SERVICE_START_FAILED"
}
```

第 28 模块结果时间与前一个阶段快照相差约 `12142 ms`，基本等于启动 Shell 外层 `timeout 12` 的预算。

## 2. 已确认事项

Shell 的前置输出成功返回，因此确认：

```text
ShortX ShellCommand 已执行
Shell UID 为 0
旧 endpoint 存在
启动前没有检测到 sing-box 核心进程
Shell stderr 为空
```

## 3. 尚不能确认事项

因为终态输出为空，以下字段不能作为设备真实状态的充分证据：

```text
controlServiceStarted=false
runtimeFilesModified=false
startupRollbackAttempted=false
```

这些字段仅表示模块没有收到 `STARTED`、PID 或 rollback 输出。Shell 可能在等待 ready、等待子 Shell 退出，或控制服务启动后尚未发布终态时被外层 timeout 终止。

因此在再次启动之前，必须先检查：

```text
CoreRuntimeMain 进程
endpoint 当前 PID 和 mtime
runtime.*.pid / runtime.*.ready 临时文件
runtime-production.log 的启动期错误信号
```

## 4. 安全结果

```json
{
  "tokenValueRead": false,
  "socketNameValueRead": false,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false
}
```

## 5. 结论

当前错误应表述为：

```text
启动 Shell 事务在 12 秒内没有返回终态
```

不能直接表述为：

```text
Runtime 控制服务确定没有启动
```

下一阶段为只读事后探测，不复用已消费的启动授权，不启动或停止任何进程。