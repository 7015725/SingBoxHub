# Runtime 阶段 28 重试 4：真机完整通过

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 阶段：`runtime_stage28_retry4`
- 授权标识：`stage28-retry4-localsocket-api-order-user-authorized-20260803`
- 状态：通过

## 1. 真机关键结果

```json
{
  "ok": true,
  "dispatchResult": "REUSED",
  "reconciliationResult": "READY",
  "reconciliationSource": "endpoint",
  "existingServiceReused": true,
  "controlServicePid": 11451,
  "controlServiceProcessAlive": true,
  "controlServiceCommandValidated": true,
  "controlServiceOwnerValidated": true,
  "controlServiceRemainsRunning": true,
  "endpointFileCanonical": true,
  "endpointModeValidated": true,
  "endpointSchemaValidated": true,
  "endpointContractReady": true,
  "localSocketPublicConnectUsed": true,
  "connectTimeoutOverloadUsed": false,
  "socketReadTimeoutConfigured": true,
  "requestSent": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "socketConnected": true,
  "socketClosed": true,
  "runtimeFilesModified": false,
  "errorCode": null,
  "durationMs": 1161
}
```

## 2. 已通过门禁

1. 复用已有控制服务，不重复启动；
2. canonical endpoint、`0600` 权限、schema 和 PID 绑定通过；
3. Runtime 进程 cmdline 与 endpoint 所有者校验通过；
4. 使用公开单参数 `LocalSocket.connect(address)`；
5. 连接成功后再设置读取超时；
6. 发送且仅发送一次三行只读 `PING`；
7. 收到 `PONG`，correlation 完整回显；
8. 连接和敏感引用均已关闭或清空。

## 3. 安全边界结果

```json
{
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "runtimeFilesModified": false,
  "destructiveOperations": false
}
```

本次未启动 sing-box Core，未创建 TUN，未修改路由、配置或 Runtime 文件。

## 4. 阶段结论

Stage 28 已完成。以下生产契约现已由真机证据确认：

- detached Runtime 控制服务可持续运行；
- endpoint 可安全绑定到精确进程；
- Android abstract LocalSocket 可建立连接；
- token + correlation + `PING` 三行请求有效；
- `PONG` + correlation 两行响应有效；
- 单连接单事务关闭后服务继续存活。

下一阶段允许构建正式只读 Runtime 状态适配器。写命令继续保持锁定。
