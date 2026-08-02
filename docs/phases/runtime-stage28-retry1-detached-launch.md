# Runtime 阶段 28 重试 1：脱离式控制服务启动与一次只读 PING

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 独立入口：`entry/SingBoxHubRuntimeControlRetry1.js`
- 下载文件：`SingBoxHub_Runtime控制服务脱离启动重试1.txt`
- 入口 SHA-256：`238f840db3205039bcfb7f6788a88f70ab655b2a7c8d7446c46826392b04568b`
- Git blob SHA：`0a9f332b7c0303fb785720c0f779db09f0899d71`
- 授权标识：`stage28-retry1-detached-launch-user-authorized-20260803`
- 模块集：不变，完整 UI 仍为 `20260802.25`
- 状态：实现完成，真机单次验证待执行

## 1. 阶段目标

修复第 28 阶段首版启动器被外层 `timeout` 截断的问题。为缩短验证时间，本轮使用独立 Rhino ES5 入口，不加载 28 个 UI 模块，直接完成：

1. 检查上次失败是否遗留 Runtime 控制服务；
2. 复用与当前 endpoint 正确绑定的存活服务；
3. 对唯一且未被 endpoint 绑定的遗留控制服务执行定向清理；
4. 以非等待、脱离式方式启动新控制服务；
5. 原子生成新 endpoint；
6. 校验进程身份、命令行和 endpoint 所有者；
7. 发送一次固定 `PING`；
8. 验证 `PONG + correlation`。

## 2. 输入证据

第 28 阶段首版真机返回：

```json
{
  "startupShellExitCode": 0,
  "startupShellErrorPresent": false,
  "startupResult": "",
  "startupRollbackAttempted": false,
  "controlServiceStarted": false,
  "requestSent": false,
  "requestCount": 0,
  "socketConnectionAttempted": false,
  "errorCode": "CONTROL_SERVICE_START_FAILED"
}
```

第 28 模块执行约 12 秒后返回，与其外层 `toybox timeout 12` 一致。首版使用后台子 shell 加 `wait`，导致启动器未能在控制服务长期运行时退出并输出最终结果。

由于超时发生在后台 `app_process` 启动之后，不能排除留下一个没有正确 endpoint 绑定的控制服务进程。

## 3. 修复实现

### 3.1 独立入口

入口不下载或加载 UI 模块集，直接使用：

```text
ShortX ShellCommand
android.net.LocalSocket
Rhino ES5
```

避免完整模块同步和静态分析缓存加载造成的约 45 秒耗时。

### 3.2 启动方式

删除：

```sh
(
  nohup app_process ... &
  ...
) &
wait "$!"
```

改为：

```sh
CLASSPATH="$J" /system/bin/toybox nohup \
  "$APP_PROCESS" /system/bin \
  com.singboxhub.runtime.CoreRuntimeMain \
  "$SOCKET_NAME" "$TOKEN" "$BINARY" "$CONFIG" "$WORKDIR" "$READY" \
  </dev/null >>"$LOG" 2>&1 &
PID="$!"
```

启动器不等待长期控制服务退出，只轮询 ready 文件，最长 5 秒。整个 Shell 最长 15 秒。

### 3.3 遗留服务处理

按 `CoreRuntimeMain + configPath + workingDirectory` 匹配进程：

- `0` 个：启动新服务；
- `1` 个且 endpoint PID 与其一致：复用该服务；
- `1` 个但 endpoint PID 不一致：视为首版失败遗留，只终止该控制服务后重新启动；
- 多于 `1` 个：返回 `MULTIPLE_CONTROL_SERVICES_PRESENT`，不自动清理。

定向遗留清理只作用于匹配本项目 Runtime 类、配置和工作目录的控制服务，不触碰 sing-box 核心、其他 Java 进程、TUN 或路由。

## 4. Endpoint 和进程门禁

在读取 token 前必须全部通过：

```text
shell uid = 0
sing-box 核心进程不存在
Runtime JAR、二进制、配置、工作目录存在
control_endpoint.json canonical path 正确
endpoint mode = 600
endpoint schemaVersion = 1
endpoint runtimePid = 存活控制服务 PID
cmdline 同时匹配 serverClass、configPath、workingDirectory
endpoint UID/GID 与进程 effective/fs UID/GID 匹配
```

## 5. PING 契约

只发送一次：

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

真实 token、socketName、correlation、endpoint 原文和 Base64 内容不会出现在返回值中。

## 6. 安全边界

始终禁止：

```json
{
  "automaticRetryAllowed": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "requestCountMaximum": 1,
  "allowedCommand": "PING"
}
```

该独立入口不持久化一次性执行缓存，因此必须只执行一次。再次执行可能复用当前有效控制服务并再次发送一个新的 PING，不属于自动重试机制。

## 7. 真机目标

新启动成功：

```json
{
  "ok": true,
  "stage": "runtime_stage28_retry1",
  "launcherMode": "direct_no_wait_detached",
  "launcherDetached": true,
  "shellOutputComplete": true,
  "existingServiceReused": false,
  "controlServiceStarted": true,
  "controlServiceProcessAlive": true,
  "controlServiceCommandValidated": true,
  "controlServiceOwnerValidated": true,
  "endpointFileCanonical": true,
  "endpointModeValidated": true,
  "endpointSchemaValidated": true,
  "endpointContractReady": true,
  "tokenValueRead": true,
  "tokenValueExposed": false,
  "socketNameValueRead": true,
  "socketNameValueExposed": false,
  "requestSent": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "socketConnected": true,
  "socketClosed": true,
  "controlServiceRemainsRunning": true,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "errorCode": null,
  "error": null
}
```

若首版已经留下有效、且 endpoint 已正确绑定的控制服务，允许：

```json
{
  "ok": true,
  "existingServiceReused": true,
  "controlServiceStarted": false,
  "requestCount": 1,
  "responseStatus": "PONG"
}
```

若发现唯一孤立服务，目标还包括：

```json
{
  "orphanServiceDetected": true,
  "orphanCleanupAttempted": true,
  "orphanCleanupSucceeded": true
}
```

## 8. 下一阶段门禁

只有本轮返回 `ok=true`、`PONG` 和 correlation 均匹配，才允许把控制服务接入稳定的只读 Runtime 状态层。任何 `START`、`STOP_CORE`、`STOP_RUNTIME`、TUN、路由和配置写入继续需要独立授权。