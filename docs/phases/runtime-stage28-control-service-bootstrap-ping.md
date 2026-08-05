# Runtime 阶段 28：启动控制服务并执行一次只读 PING

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.25`
- 入口最低版本：`25`
- 模块数量：`28`
- 新模块：`src/sbh_28_runtime_control_service_bootstrap_ping.js`
- 模块内部版本：`runtimeControlServiceBootstrapPing = 1`
- 模块 SHA-256：`b6e751bc25a40f3d3df758be87f343bb8f52e0e2a0c6c99ce794c00e7a4379c5`
- 授权标识：`stage28-control-service-ping-user-authorized-20260802`
- 状态：实现完成，真机一次性验证待执行

## 1. 阶段目标

替换已确认过期的 `control_endpoint.json`，只启动 Runtime 控制服务，不启动 sing-box 核心；随后校验新 endpoint 和控制服务身份，发送一次三行只读 PING 请求并验证两行响应。

## 2. 输入证据

第 27 阶段重试 3 已确认：

```text
旧 endpoint 存在
旧 endpoint mode=600
旧 endpoint schemaVersion=1
旧 endpoint runtimePid=27363
/proc/27363 不存在
0 次 token 读取
0 次 Socket 连接
0 次请求
```

生产安装脚本确认控制服务的启动参数顺序为：

```text
socketName
token
sing-box binary
runtime config
working directory
ready file
```

生产 `ensure` 同时包含核心和 TUN 残留清理，因此本阶段按 ADR-0001 直接执行最小控制服务启动协议，不调用 `ensure`。

## 3. 实现

第 28 模块执行以下单次流程：

1. 消费第 25、26 阶段的静态只读门禁；
2. 确认 Runtime JAR、sing-box 二进制、配置、工作目录和控制目录存在；
3. 确认当前没有 sing-box 核心进程；
4. 确认当前没有匹配同一配置和工作目录的控制服务；
5. 在 root Shell 内生成随机 token 和唯一 abstract socket 名称；
6. 使用 `app_process64`，不可用时回退 `app_process`；
7. 等待 Runtime 自身创建 ready 文件；
8. 原子写入新的 `control_endpoint.json` 并设置 `0600`；
9. 使用 Shell 内建 `read + case` 读取新进程 UID/GID；
10. 校验 endpoint canonical path、schema、PID、进程命令行和所有者；
11. 在 JS 内存中读取 socketName/token；
12. 通过 Android `LocalSocket` 发送一次：

```text
<token>\n
<one-shot correlation>\n
PING\n
```

13. 只接受：

```text
PONG\n
<same correlation>\n
```

14. 关闭客户端 Socket，保留控制服务运行。

## 4. 安全边界

明确禁止：

```json
{
  "singBoxCoreStartAuthorized": false,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "automaticRetryAllowed": false,
  "requestCountMaximum": 1,
  "allowedCommand": "PING",
  "destructiveOperations": false
}
```

真实 token、socketName、correlation、endpoint 原文和 Base64 内容不会进入最终返回或缓存。

允许写入范围：

```text
runtime/control/control_endpoint.json
runtime/control/runtime.*.ready
runtime/control/runtime.*.pid
logs/runtime-production.log
```

## 5. 回滚

以下启动期错误会终止本次新建的控制服务，并清理本次临时文件：

```text
RUNTIME_READY_TIMEOUT
ENDPOINT_WRITE_FAILED
ENDPOINT_CHMOD_FAILED
ENDPOINT_REPLACE_FAILED
```

控制服务已经成功启动后，若身份校验或 PING 失败，则保留控制服务和 endpoint，不自动停止，以避免扩大授权范围。

## 6. 真机目标

首次执行 v25 目标：

```json
{
  "entryVersion": 25,
  "moduleSetVersion": "20260802.25",
  "runtimeControlServiceBootstrapPing": "control_service_started_readonly_ping_verified",
  "runtimeControlServiceBootstrapPingDetails": {
    "authorizationConsumed": true,
    "staleEndpointDetected": true,
    "staleEndpointReplaced": true,
    "startupResult": "STARTED",
    "startupShellExitCode": 0,
    "controlServiceStarted": true,
    "controlServicePid": ">1",
    "controlServiceProcessAlive": true,
    "controlServiceCommandValidated": true,
    "controlServiceOwnerValidated": true,
    "endpointFileCanonical": true,
    "endpointModeValidated": true,
    "endpointSchemaValidated": true,
    "endpointFresh": true,
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
    "destructiveOperations": false,
    "errorCode": null,
    "error": null
  }
}
```

第二次执行必须只复用缓存，不再次启动控制服务或连接 Socket：

```json
{
  "reusedCachedResult": true,
  "requestCount": 1
}
```

## 7. 下一阶段门禁

只有首次真实 PING 成功，并确认第二次执行不产生新的启动或连接，才允许建立稳定的只读 Runtime 状态适配层。`START`、`STOP_CORE`、`STOP_RUNTIME`、TUN、路由和配置写入仍需独立阶段与明确授权。