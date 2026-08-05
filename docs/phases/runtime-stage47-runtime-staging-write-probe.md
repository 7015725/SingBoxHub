# Runtime Stage 47：Runtime staging 临时写入探测

## 授权

用户在 Stage 46 Retry 2 只读审计通过后明确回复“下一阶段”，授权执行一次手动 Runtime staging 临时写入探测。

授权标识：

`stage47-runtime-staging-write-probe-user-authorized-20260804`

该授权仅覆盖本阶段定义的两个固定临时探测文件，不覆盖生产配置替换、备份创建、Core/TUN 启动或路由修改。

## 基线

Stage 46 Retry 2 已确认：

- selector 临时配置检查通过；
- 生产目标为 `config/runtime-tun.json`；
- 生产配置为普通文件、可读、不是符号链接；
- 当前配置与候选配置哈希不同；
- `readOnlyAuditPassed=true`；
- `promotionNeeded=true`；
- `readyForExplicitStagingWriteProbe=true`；
- `nextAuthorizedOperation=runtime_directory_staging_write_probe`。

## 实现

Stage 47 使用已经通过真机验证的本地 `20260803.22` 40 模块缓存，并顺序加载两个内联模块：

1. `sbh_64_production_promotion_audit_compact.js`
2. `sbh_65_runtime_staging_write_probe.js`

入口不读取远程 manifest，也不下载模块。

点击按钮后先重新执行 Stage 46 只读审计；只有审计仍通过并且 `readyForExplicitStagingWriteProbe=true` 时，才执行写入探测。

## 探测范围

仅在 Runtime 的 `config` 目录使用两个保留文件名：

- `.sbh-stage47-write-probe.a`
- `.sbh-stage47-write-probe.b`

操作顺序：

1. 清理同名旧探测残留；
2. 记录生产配置哈希、大小、mode、uid、gid；
3. 记录 config 目录 mode、uid、gid、device；
4. 记录 backup 目录是否存在以及是否为符号链接；
5. 创建 mode `0600` 的临时文件；
6. 写入随机非敏感测试载荷；
7. 执行文件同步；
8. 记录哈希、大小、inode、device；
9. 在同一目录执行 `mv` rename；
10. 校验 rename 前后哈希、大小、inode、device 与 mode；
11. 删除探测文件；
12. 校验两个探测路径均不存在；
13. 重新计算生产配置哈希及元数据；
14. 确认 backup 目录状态未变化；
15. 输出完成标记。

Shell transport 的 `shellCode` 继续仅用于诊断；成功门禁以明确完成标记和逐项校验结果为准。

## 安全边界

本阶段不会：

- 替换或修改 `config/runtime-tun.json`；
- 写入候选生产配置；
- 创建正式 staging 配置；
- 创建备份文件或备份目录；
- 启动或停止 Core；
- 创建 TUN；
- 修改路由、DNS 或防火墙；
- 返回节点凭据或探测载荷；
- 自动重试。

本阶段会临时创建并删除两个 Runtime 文件，因此会改变 config 目录时间戳。目录 mode、uid、gid 和 device 必须保持不变。

## 通过门禁

启动：

- `entryVersion=65`
- `moduleSetVersion=20260803.22+audit64+stage47-inline`
- `localBaseModulesVerified=true`
- `inlineModuleVerified=true`
- `secondInlineModuleVerified=true`
- `runtimeStagingWriteProbeReady=true`
- `runtimeStagingWriteProbeAuthorized=true`

动作：

- `ok=true`
- `stage=production_stage47_runtime_staging_write_probe`
- `authorizationConsumed=true`
- `stage46AuditPassed=true`
- `shellUid=0`
- `runtimeDirectoryWriteProbePerformed=true`
- `temporaryRuntimeFilesCreated=true`
- `temporaryRuntimeFilesRenamed=true`
- `temporaryRuntimeFilesDeleted=true`
- `temporaryRuntimeFileHashVerified=true`
- `temporaryRuntimeFileSizeVerified=true`
- `sameInodeAfterRename=true`
- `sameDeviceAfterRename=true`
- `atomicRenameVerified=true`
- `targetConfigHashUnchanged=true`
- `targetConfigMetadataUnchanged=true`
- `runtimeDirectoryModeOwnershipDeviceUnchanged=true`
- `backupDirectoryStateUnchanged=true`
- `runtimeDirectoryContentRestored=true`
- `runtimeFilesCurrentlyModified=false`
- `productionConfigModified=false`
- `readyForExplicitCandidateStagingWrite=true`
- `nextAuthorizedOperation=runtime_candidate_staging_write_and_check`

## 入口

- 文件名：`SingBoxHub_RuntimeStaging写入探测阶段47.txt`
- Entry：65
- 模块集标识：`20260803.22+audit64+stage47-inline`
- 基础模块数：40
- Stage 47 模块 SHA-256：`48f8892c1933035dfbcf80622bc3b7998a554a143d951d8baab2821b55e24627`
- 入口 SHA-256：`49588fef8b4e6caef11cd10ecb5e467da673837ad43c12529ebef8504649b431`
