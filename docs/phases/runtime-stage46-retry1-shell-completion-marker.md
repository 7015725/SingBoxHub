# Runtime Stage 46 Retry 1：以完成标记判定只读审计成功

## 真机结果

Stage 46 首轮审计已完整返回生产配置元数据，但结果被错误判定为失败：

- `selectorPreflightPassed=true`
- `shellUid=0`
- 目标目录存在且不是符号链接
- 目标配置为普通文件、可读、不是符号链接
- `sha256sum` 与 `stat` 均可用
- 剩余空间门禁通过
- 当前配置哈希与候选配置哈希均已取得
- `shellCode=158`
- `readOnlyAuditPassed=false`

Shell 输出已包含末尾的可用空间标记，说明审计命令主体实际执行完成。问题来自把 ShortX Shell transport 的 `shellCode` 强制当成命令退出码使用。

## 修复

`sbh_62_production_promotion_audit.js` 提升到版本 2：

1. 继续在命令最后输出 `__SBH_READ_ONLY_AUDIT__=1`；
2. 只读审计成功门禁改为必须观察到该完成标记；
3. `shellCode` 保留用于诊断，但不再作为审计成功的唯一依据；
4. 若完成标记存在而 `shellCode != 0`，返回 `shellTransportCodeAnomalous=true`；
5. 若完成标记缺失，审计仍失败并返回脱敏诊断。

## 新增结果字段

- `shellCompletionMarkerObserved`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous`
- `auditSuccessDerivedFromCompletionMarker=true`

## 安全边界

本次仅修正只读结果判定：

- 不创建 staging 文件；
- 不创建备份；
- 不修改生产配置；
- 不修改 Runtime 文件或权限；
- 不启动 Core/TUN；
- 不修改路由、DNS 或防火墙。

## 通过门禁

- `shellCompletionMarkerObserved=true`
- `readOnlyAuditPassed=true`
- `promotionNeeded=true`（当前配置与候选配置不一致时）
- `readyForExplicitStagingWriteProbe=true`
- `nextAuthorizedOperation=runtime_directory_staging_write_probe`
- `productionConfigModified=false`
- `runtimeFilesModified=false`
