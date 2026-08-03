# Stage 44 Retry 1：ShortX Shell 配置检查

## 真机失败记录

Stage 44 `entryVersion=57`、`moduleSetVersion=20260803.18` 正常启动，但点击 `sing-box 临时配置检查` 后返回：

```json
{
  "ok": false,
  "errorCode": "EPHEMERAL_BINARY_CHECK_FAILED",
  "temporaryConfigPersisted": false,
  "singBoxBinaryCheckInvoked": false,
  "errorDetailReturned": false
}
```

候选配置结构预检此前已经通过：51 个节点、51 条凭据、51 个有效候选，协议为 18 个 `hysteria2` 和 33 个 `vless`。因此本次失败不属于候选结构或凭据覆盖率问题。

## 根因

Stage 44 使用 Java `ProcessBuilder` 从 ShortX Rhino/`system_server` 上下文直接启动 sing-box。SingBoxHub 已验证的本机二进制执行通道是 ShortX 原生 `ShellCommand`：

```javascript
var action = ShellCommand.newBuilder()
    .setCommand(command)
    .setSingleShot(true)
    .setId(id)
    .build();

var result = shortx.executeAction(action);
```

该通道在设备上已经验证为 `uid=0`，并可读取 `shellOut`、`shellErr`、`shellCode`。Stage 44 的 Java 进程通道不符合项目既定执行边界。

## Retry 1 修改

新增：

```text
src/sbh_57_shortx_shell_binary_check.js
```

模块在 UI 加载完成后覆盖 `SBH.candidateConfigPreflight.binaryCheckAsync()`，改用：

```text
ShortX ShellCommand + shortx.executeAction()
```

不再使用 Java `ProcessBuilder`。

模块加载顺序：

```text
sbh_55_ephemeral_binary_check_ui.js
sbh_57_shortx_shell_binary_check.js
sbh_56_binary_check_error_redaction.js
```

错误脱敏模块最后加载，继续移除外层原始异常。

## 模块集

```text
entryVersion: 58
moduleSetVersion: 20260803.19
moduleCount: 36
pinnedModuleCommit: 774b1483833509c5bf3e14a17556f5f62646f381
```

新增模块 SHA-256：

```text
1ee7b2f5963e9aa1be10ead79c5a65da8f59a4a619d91bf1fef88a552ad4038e
```

## 安全边界

Retry 1 仍然只执行临时检查：

- 逐条从 Android Keystore 解密凭据；
- 仅支持本次真机已有的 `vless` 与 `hysteria2` 候选；
- 生成客户端缓存临时配置；
- 通过 ShortX Shell 执行 `sing-box check -c`；
- 尽力覆盖并删除临时文件；
- 返回脱敏诊断；
- 不返回候选对象、密码、UUID、密钥或完整 URI；
- 不替换生产配置；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙。

## 真机门禁

启动结果必须包含：

```json
{
  "entryVersion": 58,
  "moduleSetVersion": "20260803.19",
  "moduleSetActivated": true,
  "shortxShellBinaryCheckReady": true,
  "candidateBinaryCheckTransport": "shortx_shell_action",
  "candidateBinaryCheckShortxExecuteActionUsed": true,
  "candidateBinaryCheckJavaProcessBuilderUsed": false
}
```

检查成功结果必须包含：

```json
{
  "ok": true,
  "executionTransport": "shortx_shell_action",
  "shortxExecuteActionUsed": true,
  "javaProcessBuilderUsed": false,
  "shellUid": 0,
  "singBoxBinaryCheckInvoked": true,
  "singBoxExitCode": 0,
  "singBoxCheckPassed": true,
  "temporaryConfigDeleted": true,
  "productionConfigModified": false,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false
}
```
