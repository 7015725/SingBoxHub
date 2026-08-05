# Runtime Stage 48：候选配置写入 Runtime staging 并检查

## 授权

用户在 Stage 47 真机通过后回复“下一阶段”，本阶段将其解释为对以下单次、手动操作的明确授权：

- 授权 ID：`stage48-runtime-candidate-staging-user-authorized-20260804`
- 自动重试：禁用
- 生产配置替换：禁用
- 正式备份：禁用
- Core/TUN/路由操作：禁用

## 前置门禁

Stage 47 真机结果已确认：

- `runtimeDirectoryWriteProbePerformed=true`
- `atomicRenameVerified=true`
- `targetConfigHashUnchanged=true`
- `runtimeDirectoryContentRestored=true`
- `runtimeFilesCurrentlyModified=false`
- `readyForExplicitCandidateStagingWrite=true`

Stage 48 动作开始时仍会重新执行 Stage 47 门禁，不依赖未持久化的历史 UI 结果。

## 实现

新增 `sbh_66_runtime_candidate_staging.js`：

1. 调用 Stage 47 写入探测并要求通过；
2. 在 Stage 45 selector 预检的受控 `JSON.stringify` 链中捕获已注入 selector 的实际候选配置；
3. 候选配置先写入客户端缓存中的 0600 临时源文件；
4. Root ShortX Shell 校验源文件 SHA-256 和字节数；
5. 将候选配置写入：
   `config/.runtime-tun.json.stage-<candidate-sha256-prefix>`；
6. staging 文件强制为 `0600`、uid 0、gid 0；
7. 在临时文件和最终 staging 文件上分别执行 `sing-box check`；
8. 检查通过后保留 staging 文件，供下一阶段备份和原子提升；
9. 客户端临时源文件覆盖并删除；
10. 再次确认 `config/runtime-tun.json` 的哈希和元数据未改变，备份目录状态未改变。

如果最终 `sing-box check` 失败，模块会覆盖并删除本次候选 staging 文件。

## 凭据边界

本阶段的候选配置包含可运行节点所需的操作凭据，因此：

- staging 文件是明文运行配置，不宣称加密；
- 文件权限固定为 0600；
- 所有者固定为 root；
- 配置内容、绝对路径、节点 UUID、密码和密钥均不返回 UI；
- UI 只返回哈希、字节数、相对路径和元数据结果。

## 不执行的操作

- 不替换 `config/runtime-tun.json`；
- 不创建 `config/backups`；
- 不创建正式生产备份；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙；
- 不启用自动重试。

## 通过门禁

- `stage47ProbePassed=true`
- `selectorPreflightPassed=true`
- `candidateConfigClientTemporarySourceDeleted=true`
- `candidateConfigWrittenToRuntime=true`
- `candidateConfigStagingRetained=true`
- `candidateConfigStagingHashVerified=true`
- `candidateConfigStagingSizeVerified=true`
- `candidateConfigStagingMode=600`
- `candidateConfigStagingUid=0`
- `candidateConfigStagingGid=0`
- `singBoxFinalStagingCheckExitCode=0`
- `singBoxFinalStagingCheckPassed=true`
- `targetConfigHashUnchanged=true`
- `targetConfigMetadataUnchanged=true`
- `backupDirectoryStateUnchanged=true`
- `productionConfigModified=false`
- `backupCreated=false`
- `readyForExplicitBackupAndAtomicPromotion=true`
- `nextAuthorizedOperation=runtime_backup_and_atomic_promotion`

## 发布方式

由于远程严格模块集此前出现 SHA-256 不一致，本阶段沿用已验证的离线启动链：

- 本地校验并加载 Stage 45 的 40 个基础模块；
- 内联加载 Stage 46 紧凑审计模块；
- 内联加载 Stage 47 写入探测模块；
- 内联加载 Stage 48 候选 staging 模块；
- 不读取远程 manifest，不下载模块。
