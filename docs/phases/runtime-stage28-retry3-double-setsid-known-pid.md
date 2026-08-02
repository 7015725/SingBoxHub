# Runtime 阶段 28 重试 3：双 setsid 与已知 PID 复核

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 下载文件：`SingBoxHub_Runtime控制服务双setsid重试3.txt`
- 下载文件 SHA-256：`c5f5ced57468d50626a7ebcafe7e87413c25e6bc51fe7ce82780ea0e86a55574`
- 授权标识：`stage28-retry3-double-setsid-known-pid-user-authorized-20260803`
- 阶段：`runtime_stage28_retry3`
- 状态：实现完成，真机单次验证待执行

## 1. 阶段目标

Retry 2 的启动事务和只读复核均未返回终态。Retry 3 同时移除两个阻塞点：

1. 不再全量扫描 `/proc`；
2. 不再使用 `setsid ... &`。

新流程：

```text
精确前置检查
        ↓
双 setsid 同步派发
        ↓
本次事务 PID 文件
        ↓
独立已知 PID 复核
        ↓
原子发布 endpoint
        ↓
一次 LocalSocket PING
```

## 2. 双 setsid 派发

启动 Shell 使用：

```sh
toybox setsid toybox setsid -d /system/bin/sh -c '<inner launcher>' ...
```

不使用后台 `&`。

内层启动器执行：

1. 将自身 `$$` 写入本次事务的临时 PID 文件；
2. 设置 mode `0600`；
3. 原子移动为正式事务 PID 文件；
4. 设置 `CLASSPATH`；
5. 使用 `exec app_process` 替换自身。

因此事务 PID 与最终 `CoreRuntimeMain` PID 保持一致，不需要通过全量进程扫描重新发现服务。

## 3. 已知 PID 复核

复核只允许两个 PID 来源：

### 3.1 canonical endpoint

若旧 endpoint 中的 PID：

- 仍存活；
- cmdline 同时匹配 `CoreRuntimeMain`、配置路径和工作目录；

则复用该服务。

### 3.2 本次事务 PID 文件

若 endpoint 不可复用，则只等待本次事务的精确 PID 文件：

```text
runtime/control/runtime.<createdAt>.<nonce>.pid
```

不遍历全部 `/proc/[0-9]*`。读取 PID 后仅检查对应：

```text
/proc/<pid>/cmdline
/proc/<pid>/status
```

## 4. endpoint 发布

只有本次新服务满足以下条件后才发布 endpoint：

```text
事务 PID 文件存在且为纯数字
目标 PID 存活
cmdline 身份匹配
ready 文件出现
```

随后通过临时文件和 `mv` 原子发布：

```text
runtime/control/.control_endpoint.<createdAt>.<nonce>.tmp
runtime/control/control_endpoint.json
```

endpoint mode 必须为 `600`。

## 5. 精确回滚

若本次新服务发生以下错误：

- ready 超时；
- endpoint 写入失败；
- endpoint chmod 失败；
- endpoint 原子替换失败；

只针对本次事务 PID 执行：

```text
SIGTERM
短时存活确认
必要时 SIGKILL
删除本次 PID、ready 和临时 endpoint 文件
```

不会使用 `pkill`、`killall` 或模糊进程名称。

复用旧服务时不执行启动回滚。

## 6. 孤立服务处理边界

启动前不进行全量 `/proc` 搜索。只读取 `runtime/control/runtime.*.pid` 文件，并对其中的 PID 逐个进行精确 cmdline 校验：

- `0` 个有效候选：继续启动；
- `1` 个有效候选：视为本项目孤立控制服务，定向停止并清理对应事务文件；
- 多于 `1` 个：返回 `MULTIPLE_CONTROL_SERVICE_CANDIDATES`，不批量停止。

## 7. PING 契约

仅在 endpoint、进程身份、UID/GID 和权限门禁全部通过后，发送一次：

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

返回 JSON 不暴露 token、socketName、correlation、endpoint 原文或 Base64 内容。

## 8. 安全边界

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

允许写入范围仅为：

```text
runtime/control/control_endpoint.json
runtime/control/runtime.*.ready
runtime/control/runtime.*.pid
runtime/control/.control_endpoint.*.tmp
logs/runtime-production.log
```

## 9. 静态验证

已完成：

```text
Node.js syntax check: passed
Rhino ES5 forbidden syntax scan: passed
let/const/arrow/class/template literal: absent
派发 Shell bash -n: passed
复核 Shell bash -n: passed
```

以上仅为静态验证，不代表 Android 真机启动成功。

## 10. 预期成功结果

```json
{
  "ok": true,
  "stage": "runtime_stage28_retry3",
  "launcherMode": "double_setsid_known_pid_reconcile",
  "launcherDetached": true,
  "dispatchOutputComplete": true,
  "dispatchResult": "DISPATCHED",
  "reconciliationAttempted": true,
  "reconciliationOutputComplete": true,
  "reconciliationResult": "READY",
  "controlServiceProcessAlive": true,
  "controlServiceCommandValidated": true,
  "controlServiceOwnerValidated": true,
  "controlServiceRemainsRunning": true,
  "endpointFileCanonical": true,
  "endpointModeValidated": true,
  "endpointSchemaValidated": true,
  "endpointContractReady": true,
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

## 11. 下一阶段门禁

只有真机返回 `ok=true`、`requestCount=1`、`PONG` 和 correlation 均匹配，才允许将控制服务接入长期只读 Runtime 状态层。

任何 Core 启停、TUN、路由和配置写入仍需新的独立阶段和授权。