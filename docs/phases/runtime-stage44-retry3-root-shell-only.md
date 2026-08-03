# Runtime Stage 44 Retry 3：仅 Root Shell 执行 sing-box 检查

## 前置定位

Stage 44 Retry 2 的临时权限桥已成功准备和恢复，但内部检查仍停在 `binary_precheck`：

- `permissionBridgePrepared=true`
- `permissionBridgeShellUid=0`
- `permissionBridgeRestored=true`
- `runtimeMetadataCurrentlyModified=false`
- `failureStep=binary_precheck`
- `singBoxBinaryCheckInvoked=false`

这说明失败不是普通 Unix mode 权限问题。uid=1000 Java 进程仍无法通过其 SELinux/目录访问边界完成 `File.isFile()/canExecute()`，继续 chmod 不应作为解决方向。

## Retry 3 方案

新增 `sbh_59_root_shell_only_binary_check.js`，在原有 UI 按钮之后覆盖检查动作：

1. Java 侧只负责从 Keystore 解密、构造候选配置并写入客户端临时目录；
2. 不再调用 Java `File.isFile()`、`File.canExecute()` 或 `ProcessBuilder` 检查 Runtime 二进制；
3. 二进制存在性、可执行性、临时配置可读性和 `sing-box check` 全部由 ShortX `ShellCommand` 在 uid=0 中执行；
4. 不使用临时权限桥，不修改 Runtime 权限元数据；
5. 临时配置在检查后覆盖并删除；
6. 输出继续进行路径、服务器、UUID、密码和密钥脱敏。

## 真机通过结果

2026-08-03 真机验证通过：

- `candidateCount=51`
- `candidateTypeCounts.hysteria2=18`
- `candidateTypeCounts.vless=33`
- `temporaryConfigByteCount=27762`
- `temporaryConfigWritten=true`
- `temporaryConfigOverwriteSucceeded=true`
- `temporaryConfigDeleted=true`
- `temporaryConfigPersisted=false`
- `executionTransport=shortx_shell_action`
- `shortxExecuteActionUsed=true`
- `javaBinaryPrecheckUsed=false`
- `permissionBridgeUsed=false`
- `javaProcessBuilderUsed=false`
- `shellUid=0`
- `shellBinaryExists=true`
- `shellBinaryExecutable=true`
- `shellConfigReadable=true`
- `singBoxBinaryCheckInvoked=true`
- `singBoxCheckTimedOut=false`
- `singBoxExitCode=0`
- `singBoxCheckPassed=true`

因此，后续 sing-box 二进制检查正式采用 `ShortX ShellCommand + shortx.executeAction()`，不再使用 Java `ProcessBuilder`、Java 文件预检查或权限桥。

## 安全边界

- 不修改生产配置；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙；
- 不返回候选 outbound 或凭据明文；
- 不使用 Java `ProcessBuilder`；
- 不使用 Java 二进制预检查；
- 不使用权限桥；
- 临时配置完成检查后覆盖并删除。
