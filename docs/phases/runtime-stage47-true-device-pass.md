# Runtime Stage 47：Runtime staging 临时写入探测真机通过

## 真机结果

Stage 47 在 Android 14 / ShortX / KernelSU 环境完成受限 Runtime 写入探测：

- `ok=true`
- `stage=production_stage47_runtime_staging_write_probe`
- `authorizationConsumed=true`
- `stage46AuditPassed=true`
- `stage46PromotionNeeded=true`
- `runtimeDirectoryWriteProbePerformed=true`
- `temporaryRuntimeFilesCreated=true`
- `temporaryRuntimeFilesRenamed=true`
- `temporaryRuntimeFilesDeleted=true`
- `temporaryRuntimeFileMode=600`
- `temporaryRuntimeFileHashVerified=true`
- `temporaryRuntimeFileSizeVerified=true`
- `sameInodeAfterRename=true`
- `sameDeviceAfterRename=true`
- `atomicRenameTestPerformed=true`
- `atomicRenameVerified=true`
- `targetConfigHashUnchanged=true`
- `targetConfigMetadataUnchanged=true`
- `runtimeDirectoryModeOwnershipDeviceUnchanged=true`
- `backupDirectoryStateUnchanged=true`
- `runtimeDirectoryContentRestored=true`
- `runtimeFilesCurrentlyModified=false`
- `productionConfigModified=false`
- `backupCreated=false`
- `backupDirectoryCreated=false`
- `candidateConfigWrittenToRuntime=false`
- `coreStartInvoked=false`
- `tunCreated=false`
- `routeModified=false`
- `readyForExplicitCandidateStagingWrite=true`
- `nextAuthorizedOperation=runtime_candidate_staging_write_and_check`

## Shell transport

ShortX Shell 仍返回 `shellCode=158`，但完整执行标记存在：

- `shellCompletionMarkerObserved=true`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`
- `auditSuccessDerivedFromCompletionMarker=true`

因此继续以命令末尾完成标记和完整状态门禁作为结果依据。

## 元数据说明

临时文件创建和删除会更新 `config` 目录时间戳，因此：

- `runtimeMetadataModifiedTemporarily=true`
- `runtimeMetadataCurrentlyModified=true`
- `runtimeDirectoryTimestampMayHaveChanged=true`

这里的 `runtimeMetadataCurrentlyModified=true` 仅表示目录时间戳已发生持久变化，不表示 Runtime 文件内容、权限、所有者或设备号仍处于异常状态。目录内容已恢复，生产配置哈希和元数据未变化。

## 阶段结论

Runtime `config` 目录具备以下能力：

1. 创建 0600 staging 文件；
2. 同目录执行原子 rename；
3. rename 前后保持 inode 与 device 一致；
4. 清理后恢复目录内容；
5. 不影响现有生产配置和备份目录状态。

Stage 47 通过，下一授权边界为：

`runtime_candidate_staging_write_and_check`

下一阶段允许将已通过 selector 预检的候选配置写入 Runtime 同目录 staging 文件并执行 `sing-box check`，但仍不得替换生产配置、创建正式备份或启动 Core/TUN。