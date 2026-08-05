# Runtime 阶段 28 重试 3：控制服务启动成功，LocalSocket 调用顺序失败

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 阶段：`runtime_stage28_retry3`
- 授权标识：`stage28-retry3-double-setsid-known-pid-user-authorized-20260803`
- 状态：控制服务启动门禁通过；客户端 LocalSocket 调用失败；进入 Retry 4

## 1. 真机关键结果

```json
{
  "ok": false,
  "launcherMode": "double_setsid_known_pid_reconcile",
  "fullProcScanUsed": false,
  "knownPidFilesOnly": true,
  "launcherDetached": true,
  "dispatchOutputComplete": true,
  "dispatchResult": "DISPATCHED",
  "reconciliationOutputComplete": true,
  "reconciliationResult": "READY",
  "reconciliationSource": "transaction",
  "endpointPublished": true,
  "controlServiceStarted": true,
  "controlServicePid": 11451,
  "controlServiceProcessAlive": true,
  "controlServiceCommandValidated": true,
  "controlServiceOwnerValidated": true,
  "controlServiceRemainsRunning": true,
  "endpointFileCanonical": true,
  "endpointModeValidated": true,
  "endpointSchemaValidated": true,
  "endpointContractReady": true,
  "tokenValueRead": true,
  "socketNameValueRead": true,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "socketConnected": false,
  "error": "java.io.IOException: JavaException: java.io.IOException: socket not created",
  "durationMs": 2077
}
```

## 2. 已确认成功项

Retry 3 已解决此前的启动器和复核超时：

1. 双 `setsid` 派发在 ShortX ShellCommand 中正常返回；
2. 未使用全量 `/proc` 扫描；
3. 本次事务 PID 文件成功绑定到最终 `CoreRuntimeMain`；
4. 控制服务 PID `11451` 存活；
5. cmdline、UID/GID、endpoint canonical path、mode `600`、schema 均通过；
6. endpoint 已原子发布；
7. 控制服务在脚本结束后保持运行。

因此，Stage 28 的“控制服务直接启动与重新附加”主门禁已经通过。

## 3. LocalSocket 失败根因

Retry 3 的顺序为：

```java
LocalSocket socket = new LocalSocket();
socket.setSoTimeout(2000);
socket.connect(address, 1500);
```

Android AOSP 实现中：

- `new LocalSocket()` 仅构造 Java 包装对象；
- 底层 AF_UNIX 文件描述符由 `connect(LocalSocketAddress)` 内部的 `implCreateIfNeeded()` 创建；
- `setSoTimeout()` 直接调用 `LocalSocketImpl.setOption()`，不会触发 `implCreateIfNeeded()`；
- 文件描述符尚未创建时，`setOption()` 抛出 `IOException("socket not created")`；
- `connect(LocalSocketAddress, int)` 双参数重载本身直接抛出 `UnsupportedOperationException`。

真机字段 `socketConnectionAttempted=false` 与该调用顺序完全一致：异常发生在 `setSoTimeout()`，尚未执行连接。

## 4. Retry 4 修复

Retry 4 固定使用公开 API 顺序：

```java
LocalSocket socket = new LocalSocket();
socket.connect(new LocalSocketAddress(name, Namespace.ABSTRACT));
socket.setSoTimeout(2000);
```

随后才创建输入输出流并发送一次：

```text
<token>\n
<correlation>\n
PING\n
```

不再调用 `connect(LocalSocketAddress, int)`。

## 5. 安全边界结果

```json
{
  "automaticRetryAllowed": false,
  "requestSent": false,
  "requestCount": 0,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false,
  "tokenValueExposed": false,
  "socketNameValueExposed": false
}
```

本轮没有发送任何控制请求，也没有触发 sing-box Core、TUN、路由或配置操作。

## 6. 下一阶段门禁

Retry 4 只验证 Android LocalSocket 公开 API 调用顺序和一次只读 `PING`：

- 优先复用 PID `11451` 对应的有效 endpoint；
- 若服务仍存活，不重新启动服务；
- 最多发送一次 `PING`；
- 成功条件为 `PONG` 和 correlation 回显同时匹配；
- 未成功前，不进入 Runtime 长期状态层和任何 Core/TUN/路由操作。
