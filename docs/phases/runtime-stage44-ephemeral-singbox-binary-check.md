# Stage 44：临时完整配置与 sing-box 二进制检查

## 前置结果

Stage 43 真机通过：

- 节点总数：51
- 凭据链接：51
- 成功解密：51
- 候选 outbound：51
- 结构有效：51
- 不支持类型：0
- 无效候选：0
- 协议：hysteria2 18、vless 33
- 候选对象、凭据明文和配置文件均未返回或持久化

## 目标

在不接触生产 Runtime 配置的前提下，把已通过结构预检的候选 outbound 写入客户端临时配置，并调用现有 sing-box 二进制执行 `check`。

## 模块

- `sbh_53_candidate_config_preflight.js` 升级至 v2
- 新增 `sbh_55_ephemeral_binary_check_ui.js`
- 新增 `sbh_56_binary_check_error_redaction.js`
- moduleSetVersion：`20260803.18`
- entryVersion：`57`
- moduleCount：`35`
- 固定模块提交：`291eb68a2121bb83ace188e95e42213c62d7e2a8`

## 执行流程

1. 要求凭据覆盖率为 100%。
2. 从 Android Keystore 保险库逐条解密凭据。
3. 在内存中构造候选 outbound，并重新执行结构门禁。
4. 为节点生成确定性、唯一且不含原名称的 tag。
5. 仅生成包含 `outbounds` 的最小配置。
6. 写入 `SingBoxHubClient/cache/ephemeral-config-check/` 下的随机临时文件。
7. 调用 `SingBoxHub/bin/sing-box check -c <临时文件>`。
8. 最长等待 30 秒，合并并限制输出为 256 KiB。
9. 成功时不返回二进制原始输出；失败时对路径、服务器、tag、UUID、密码、密钥等已知值执行脱敏。
10. 外层异常只返回固定错误码，不回传原始 Java 错误文本。
11. 对临时文件执行尽力覆盖并删除，再清除内存引用。

## 安全边界

- 不替换 `/SingBoxHub/config/` 下的生产配置。
- 不修改 Runtime 文件。
- 不启动或停止 Core。
- 不创建 TUN。
- 不修改路由、DNS 或防火墙。
- 不访问订阅网络。
- 不返回临时文件绝对路径。
- 不返回候选 outbound 或凭据明文。
- 不返回未脱敏的 Java/CLI 外层错误。
- Flash/文件系统层面的物理安全擦除不作保证，结果中明确返回 `temporaryConfigSecureEraseGuaranteed=false`。

## 真机门禁

启动：

- `entryVersion=57`
- `moduleSetVersion=20260803.18`
- `moduleSetActivated=true`
- `candidateBinaryCheckReady=true`
- `ephemeralBinaryCheckUiReady=true`
- `ephemeralBinaryCheckButtonReady=true`
- `ephemeralBinaryCheckOuterErrorReturned=false`
- `ephemeralBinaryCheckSanitizedDiagnosticOnly=true`

手动检查通过：

- `candidateCount=51`
- `singBoxBinaryCheckInvoked=true`
- `singBoxCheckFinished=true`
- `singBoxCheckTimedOut=false`
- `singBoxExitCode=0`
- `singBoxCheckPassed=true`
- `temporaryConfigWritten=true`
- `temporaryConfigOverwriteAttempted=true`
- `temporaryConfigDeleted=true`
- `temporaryConfigPersisted=false`
- `productionConfigModified=false`
- `runtimeFilesModified=false`
- `coreStartInvoked=false`
- `tunCreated=false`
- `routeModified=false`

二进制检查失败时，不进入生产配置阶段；根据脱敏诊断修正协议字段映射。
