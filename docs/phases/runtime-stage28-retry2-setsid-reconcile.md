# Runtime 阶段 28 重试 2：setsid 分离启动与二次复核

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 下载文件：`SingBoxHub_Runtime控制服务脱离启动重试2.txt`
- 下载文件 SHA-256：`56b37873b2158dbfce9f5729e845a75e97d715ec51a950cec7eca448b252507f`
- 授权标识：`stage28-retry2-setsid-reconcile-user-authorized-20260803`
- 状态：实现完成，真机单次验证待执行

## 1. 阶段目标

Retry 1 在约 15 秒返回 `CONTROL_SERVICE_START_OUTPUT_INCOMPLETE`。Retry 2 不再把“启动命令完整返回”作为服务存在性的唯一证据，而是将流程拆分为：

```text
精确预检与必要清理
        ↓
toybox setsid 启动控制服务
        ↓
独立只读 Shell 二次复核
        ↓
endpoint / 进程所有者门禁
        ↓
一次 LocalSocket PING
```

## 2. 关键修改

### 2.1 新会话启动

启动命令改为：

```sh
CLASSPATH="$J" /system/bin/toybox setsid \
  "$APP_PROCESS" /system/bin \
  com.singboxhub.runtime.CoreRuntimeMain \
  "$SOCKET_NAME" "$TOKEN" "$BINARY" "$CONFIG" "$WORKDIR" "$READY" \
  </dev/null >>"$LOG" 2>&1 &
```

与 `nohup` 相比，`setsid` 明确建立新会话，避免长驻 Runtime 控制服务继续绑定原 Shell 会话或进程组。

### 2.2 两次 ShellCommand

第一段为授权启动事务，最长 8 秒；第二段为只读复核，最长 6 秒。

第二段不会启动进程，也不会因第一段输出不完整再次启动。它只检查：

- 匹配控制服务数量必须为 `1`；
- endpoint 文件存在且 canonical path 正确；
- endpoint PID 与唯一控制服务 PID 一致；
- 目标进程存活；
- cmdline 同时匹配 `CoreRuntimeMain`、配置路径和工作目录；
- endpoint mode 为 `600`；
- endpoint UID/GID 与进程 effective/fs UID/GID 一致；
- endpoint schemaVersion、runtimePid 和 serverClass 正确。

只要第二段复核成功，即使第一段 Shell 返回码或输出不完整，也允许继续完成一次 PING；这只代表对同一个已存在服务进行状态收敛，不是再次启动。

### 2.3 遗留状态收敛

启动前按精确 cmdline 识别控制服务：

- `0` 个：启动新服务；
- `1` 个且 endpoint PID 与其一致：复用；
- `1` 个且 endpoint PID 不一致：只终止该唯一、精确匹配的孤立控制服务，再启动；
- 多于 `1` 个：返回 `MULTIPLE_CONTROL_SERVICES_PRESENT`，不批量终止。

不使用 `pkill`、`killall` 或模糊进程名。

## 3. PING 契约

通过全部门禁后只发送一次：

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

返回 JSON 不包含 token、socketName、correlation、endpoint 原文或 Base64 内容。

## 4. 安全边界

允许写入范围仅为：

```text
runtime/control/control_endpoint.json
runtime/control/runtime.*.ready
runtime/control/runtime.*.pid
runtime/control/.control_endpoint.*.tmp
logs/runtime-production.log
```

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

## 5. 预期成功结果

```json
{
  "ok": true,
  "stage": "runtime_stage28_retry2",
  "launcherMode": "toybox_setsid_reconcile",
  "launcherDetached": true,
  "reconciliationAttempted": true,
  "reconciliationOutputComplete": true,
  "controlServiceProcessAlive": true,
  "controlServiceCommandValidated": true,
  "controlServiceOwnerValidated": true,
  "controlServiceRemainsRunning": true,
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
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "errorCode": null,
  "error": null
}
```

第一段启动 Shell 即使输出不完整，只要第二段复核成功，也可出现：

```json
{
  "launchOutputComplete": false,
  "reconciliationOutputComplete": true,
  "ok": true
}
```

该组合是允许结果，表示服务已被真实状态复核收敛。

## 6. 静态验证

本地完成：

```text
Node.js syntax check: passed
Rhino ES5 keyword scan: passed
let/const/arrow/class: absent
```

## 7. 下一阶段门禁

只有真机返回 `ok=true`、`requestCount=1`、`PONG` 和 correlation 均匹配，才允许：

1. 将控制服务状态接入长期只读 Runtime 状态层；
2. 为后续显式 `STATUS` 适配建立稳定客户端封装；
3. 讨论单独授权的 Runtime 停止与异常恢复。

任何 Core 启停、TUN、路由和配置写入仍需新的独立阶段与授权。