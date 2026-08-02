# Runtime 阶段 28 重试 4：修正 Android LocalSocket API 调用顺序

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 下载文件：`SingBoxHub_Runtime控制服务LocalSocket修复重试4.txt`
- 下载文件 SHA-256：`4d6213a4c477ac52534014e986c977f0a903f156e1151f31e71c1ce54cd90d7f`
- 阶段：`runtime_stage28_retry4`
- 授权标识：`stage28-retry4-localsocket-api-order-user-authorized-20260803`
- 状态：实现完成，真机单次验证待执行

## 1. 阶段目标

复用 Retry 3 已成功启动并验证的 Runtime 控制服务，修正客户端 LocalSocket 调用顺序，完成一次只读 `PING`。

本阶段不扩大服务端、Runtime 文件或控制协议范围。

## 2. 根因修复

错误顺序：

```java
LocalSocket socket = new LocalSocket();
socket.setSoTimeout(2000);
socket.connect(address, 1500);
```

修复顺序：

```java
LocalSocket socket = new LocalSocket();
socket.connect(address);
socket.setSoTimeout(2000);
```

原因：

1. `LocalSocket()` 构造函数不会立即创建底层 AF_UNIX 文件描述符；
2. 单参数 `connect(LocalSocketAddress)` 会调用 `implCreateIfNeeded()`；
3. `setSoTimeout()` 不会创建 socket，只能在底层 fd 已存在后调用；
4. 双参数 `connect(LocalSocketAddress, int)` 在 Android AOSP 中是不支持的占位重载。

## 3. 控制服务复用策略

Retry 4 保留 Retry 3 的已知 PID 复核：

- canonical endpoint 中的 PID 有效时返回 `REUSED`；
- 只检查 endpoint PID 和事务 PID 文件；
- 不遍历全部 `/proc`；
- 若 Retry 3 控制服务仍存活，不重新启动、不替换 endpoint；
- 只有服务已失效时，才按原有双 `setsid` 安全流程重新派发一次。

## 4. 新增诊断字段

```json
{
  "localSocketWrapperCreated": false,
  "localSocketPublicConnectUsed": false,
  "connectTimeoutOverloadUsed": false,
  "socketReadTimeoutConfigured": false
}
```

成功连接后应为：

```json
{
  "localSocketWrapperCreated": true,
  "localSocketPublicConnectUsed": true,
  "connectTimeoutOverloadUsed": false,
  "socketConnectionAttempted": true,
  "socketConnected": true,
  "socketReadTimeoutConfigured": true
}
```

## 5. 精确错误分类

- `LOCAL_SOCKET_CONNECT_FAILED`
- `LOCAL_SOCKET_READ_TIMEOUT_CONFIG_FAILED`
- `LOCAL_SOCKET_REQUEST_WRITE_FAILED`
- `LOCAL_SOCKET_RESPONSE_READ_FAILED`
- `STAGE28_RETRY4_FAILED`

这样可以区分连接、超时配置、写请求和读响应四个阶段。

## 6. PING 契约

仅发送一次：

```text
<token>\n
<one-shot correlation>\n
PING\n
```

只接受：

```text
PONG\n
<same correlation>\n
```

返回结果继续禁止暴露 token、socketName、correlation 和 endpoint 原文。

## 7. 安全边界

```json
{
  "automaticRetryAllowed": false,
  "fullProcScanUsed": false,
  "requestCountMaximum": 1,
  "allowedCommand": "PING",
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false
}
```

## 8. 静态验证

已完成：

```text
Node.js syntax check: passed（临时复制为 .js 后检查）
Rhino ES5 forbidden syntax scan: passed
let/const/arrow/class/template literal: absent
双参数 LocalSocket.connect overload: absent
setSoTimeout before connect: absent
```

静态验证不代表真机 Socket 已连接成功。

## 9. 预期成功结果

```json
{
  "ok": true,
  "stage": "runtime_stage28_retry4",
  "dispatchResult": "REUSED",
  "reconciliationResult": "READY",
  "reconciliationSource": "endpoint",
  "existingServiceReused": true,
  "endpointContractReady": true,
  "localSocketWrapperCreated": true,
  "localSocketPublicConnectUsed": true,
  "connectTimeoutOverloadUsed": false,
  "socketConnectionAttempted": true,
  "socketConnected": true,
  "socketReadTimeoutConfigured": true,
  "requestSent": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "socketClosed": true,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "errorCode": null,
  "error": null
}
```

若控制服务在两次测试间已退出，允许出现 `DISPATCHED` 和 `reconciliationSource=transaction`，但其余成功门禁不变。

## 10. 下一阶段门禁

只有 Retry 4 真机返回一次 `PONG` 且 correlation 匹配，才进入长期只读 Runtime 状态层接入。Core 启停、TUN、路由和配置写入仍保持关闭。
