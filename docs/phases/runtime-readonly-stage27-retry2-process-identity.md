# Runtime 只读适配阶段 27 重试 2：绑定 Runtime 进程身份的真实 PING

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.23`
- 入口最低版本：`24`
- 模块数量：`27`
- 修改模块：`src/sbh_27_runtime_readonly_socket_ping.js`
- 模块内部版本：`runtimeReadonlySocketPing = 3`
- 模块 SHA-256：`4a271446bf26bbc6a7efc2721d55666e97c128f28b647e21617274a73f4e0def`
- 授权标识：`stage27-retry2-user-authorized-20260802`
- 状态：真机验证完成，安全失败，未连接 Socket

## 1. 阶段目标

删除重试 1 中固定的 `uid=1000/gid=1000` 假设，通过 endpoint 内的 `runtimePid` 读取 `/proc/<pid>/status`，将 endpoint 文件身份与 Runtime 进程身份绑定后，再决定是否执行一次只读 `PING`。

仅允许：

```text
PING
```

始终禁止：

```text
START
STOP_CORE
STOP_RUNTIME
未知命令
TUN、路由、配置和 Runtime 文件修改
```

## 2. 实现内容

1. 优先复用 120 秒内的 endpoint probe；
2. 缺失或过期时只刷新 endpoint，不再执行完整 Runtime inventory；
3. 校验 canonical path、`mode=600`、文件大小、schema 和 `runtimePid`；
4. 通过 root Shell 读取 `/proc/<runtimePid>/status`；
5. 绑定 endpoint UID/GID 与进程 effective/fs UID/GID；
6. 二次 stat endpoint，检查身份与元数据稳定性；
7. 所有校验完成前不提取 token 和 socketName。

## 3. 真机结果

执行结果：

```json
{
  "entryVersion": 24,
  "moduleSetVersion": "20260802.23",
  "runtimeReadonlySocketPing": "readonly_socket_ping_retry2_failed",
  "errorCode": "RUNTIME_PROCESS_UID_INVALID",
  "authorizationConsumed": true,
  "automaticRetryAllowed": false
}
```

Endpoint 已确认：

```json
{
  "endpointFileExists": true,
  "endpointFileCanonical": true,
  "endpointModeValidated": true,
  "endpointSchemaValidated": true,
  "endpointIdentity": {
    "schemaVersion": 1,
    "runtimePid": 27363,
    "uid": 0,
    "gid": 0,
    "mode": "600",
    "size": 616,
    "mtimeEpochSeconds": 1785580778
  }
}
```

Runtime 进程目录和 status 文件可访问：

```json
{
  "runtimeProcessIdentityChecked": true,
  "runtimeProcessExists": true,
  "runtimeProcessIdentityValidated": false,
  "runtimeProcessIdentity": null
}
```

失败发生在 UID 数值提取阶段。重试 2 使用以下形式：

```sh
/system/bin/toybox awk '/^Uid:/{print $2}' /proc/<pid>/status
```

至少一个 UID 输出为空，因此触发 `RUNTIME_PROCESS_UID_INVALID`。当前版本未保留 shellErr 和 shellCode，无法从结果中直接证明是 toybox 缺少 awk applet，还是该 applet 在当前环境返回空值；下一阶段将彻底移除该依赖。

## 4. 性能结果

```json
{
  "endpointRefreshElapsedMs": 560,
  "processIdentityElapsedMs": 725,
  "totalElapsedMs": 1287
}
```

相比重试 1 的约 19 秒完整刷新，endpoint 专用 probe 已显著缩短执行时间。

## 5. 安全结果

```json
{
  "endpointValueRead": true,
  "tokenValueRead": false,
  "socketNameValueRead": false,
  "correlationGenerated": false,
  "requestSent": false,
  "requestCount": 0,
  "responseRead": false,
  "socketConnectionAttempted": false,
  "socketConnected": false,
  "runtimeFilesModified": false,
  "destructiveOperations": false
}
```

本轮授权已消费，后续运行只复用脱敏失败缓存，不会自动再次连接。

## 6. 结论

重试 2 完成了 endpoint 真实身份确认：文件属于 `uid=0/gid=0`，权限和 schema 均正确。阻断项仅剩 `/proc` 身份字段解析实现，不是 endpoint、认证、Socket 或 PING 协议失败。

## 7. 下一阶段门禁

重试 3 必须：

1. 使用 `/system/bin/sh` 内建 `read + case` 解析 `Uid:` 和 `Gid:`，不依赖 awk；
2. 保存 Shell 退出码和是否存在 stderr，但不输出原始 stderr；
3. 检查 `/proc/<pid>/cmdline` 是否包含 endpoint 声明的 `serverClass` 或 `runtimeJar`；
4. 继续执行 endpoint 二次 stat；
5. 全部通过后才允许提取 token 并发送一次 `PING`；
6. 使用新的缓存 schema 和一次性授权标识。