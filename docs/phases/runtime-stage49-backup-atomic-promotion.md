# Runtime Stage 49：生产配置备份与同目录原子提升

## 授权

用户在 Stage 48 真机通过后回复“下一阶段”，本阶段将其解释为对以下单次、手动生产配置操作的明确授权：

- 授权 ID：`stage49-runtime-backup-atomic-promotion-user-authorized-20260804`
- 自动重试：禁用
- 生产配置备份：启用
- 生产配置原子替换：启用
- 精确失败回滚：启用
- Core/TUN/路由操作：禁用

该授权仅覆盖候选配置的备份与提升，不包含启动 sing-box 核心。

## 输入证据

Stage 48 真机结果已确认：

- `stage47ProbePassed=true`
- `selectorPreflightPassed=true`
- `candidateConfigStagingRetained=true`
- `candidateConfigStagingHashVerified=true`
- `candidateConfigStagingSizeVerified=true`
- `candidateConfigStagingMode=600`
- `candidateConfigStagingUid=0`
- `candidateConfigStagingGid=0`
- `singBoxFinalStagingCheckPassed=true`
- `targetConfigHashUnchanged=true`
- `productionConfigModified=false`
- `readyForExplicitBackupAndAtomicPromotion=true`
- `nextAuthorizedOperation=runtime_backup_and_atomic_promotion`

Stage 49 不依赖上一任务中的内存对象，只从 Runtime 目录重新发现和校验 Stage 48 保留的 staging 文件。

## 实现

新增 `sbh_67_runtime_backup_atomic_promotion.js`：

1. 要求 `config` 目录、`runtime-tun.json` 和 sing-box 二进制均为预期类型，拒绝符号链接；
2. 要求 `config/.runtime-tun.json.stage-*` 恰好存在一个候选文件；
3. 校验 staging 的 SHA-256、字节数、`0600` 权限、root 所有权和设备号；
4. 再次对 staging 执行 `sing-box check`；
5. 扫描 `/proc/*/cmdline`，确认没有以生产 sing-box 二进制为 argv[0] 的运行核心；
6. 校验可用空间能够覆盖备份、提升临时文件和审计记录；
7. 创建或校验 `config/backups`，权限归一化为 `0700`、root 所有；
8. 将当前生产配置复制到备份临时文件，校验哈希与字节数后原子重命名为确定性备份文件；
9. 将 staging 复制为 `config` 同目录的提升临时文件，强制 `0600`、root 所有，再次执行 `sing-box check`；
10. 通过同目录 `mv` 原子替换 `config/runtime-tun.json`；
11. 替换后校验生产配置哈希、字节数、权限、所有权、设备号，并再次执行 `sing-box check`；
12. 将授权 ID、旧/新哈希、字节数及相对文件名写入 0600 审计记录；
13. 保留原 staging 和正式备份，为下一阶段启动探测及故障恢复提供依据。

如果生产配置原本已与 staging 完全一致，本阶段按幂等成功处理，不重复备份或替换。

## 备份命名

生产备份采用确定性相对路径：

`config/backups/runtime-tun.before-<old-hash-prefix>-to-<new-hash-prefix>.json`

同一旧配置与候选配置组合重复执行时：

- 现有备份必须与旧生产配置哈希和字节数完全一致；
- 一致则复用；
- 不一致则安全失败，不覆盖未知备份。

## 原子性与回滚

- staging、提升临时文件和生产目标必须位于同一文件系统；
- 生产替换只使用同目录原子重命名；
- staging 本体不会被移动或删除；
- 生产替换后的任一哈希、权限、所有权、检查或审计写入失败，均从已验证备份创建同目录回滚临时文件并原子恢复；
- 回滚后重新校验旧生产哈希、字节数和 `sing-box check`；
- 不执行模糊进程终止，不修改任何网络资源。

## 凭据边界

生产配置、staging 和备份均包含可运行节点凭据，因此：

- 三类配置均为明文运行材料，不宣称加密；
- staging、生产配置和备份权限固定为 `0600`；
- 备份目录权限固定为 `0700`；
- 所有者固定为 root；
- UI 不返回配置正文、绝对路径、节点 UUID、密码或密钥；
- UI 仅返回哈希、字节数、相对路径及门禁结果。

## 不执行的操作

- 不启动或停止 sing-box Core；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙；
- 不连接代理节点；
- 不访问外部网络；
- 不删除 staging；
- 不删除正式备份；
- 不启用自动重试。

## 预期通过门禁

- `stage48StagingDiscovered=true`
- `stage48StagingValidated=true`
- `stagingRetained=true`
- `runningCoreCount=0`
- `backupCreated=true` 或 `backupReused=true`，生产配置已匹配时除外
- `backupHashVerified=true`
- `backupSizeVerified=true`
- `sameFilesystemVerified=true`
- `atomicRenamePerformed=true`，生产配置已匹配时除外
- `productionConfigHashMatchesCandidate=true`
- `productionConfigMode=600`
- `productionConfigUid=0`
- `productionConfigGid=0`
- `productionConfigCheckPassed=true`
- `auditRecordCreated=true`，生产配置已匹配时除外
- `rollbackInvoked=false`
- `coreStartInvoked=false`
- `tunCreated=false`
- `routeModified=false`
- `networkAccessed=false`
- `readyForExplicitCoreStartProbe=true`
- `nextAuthorizedOperation=runtime_core_start_probe_with_exact_rollback`

## 发布方式

真机测试入口继续沿用已验证的离线启动链：

- 校验并加载本地 `20260803.22` 基础模块集；
- 内联加载 Stage 49 模块；
- 不读取远程 manifest；
- 不下载模块；
- 入口版本：67。

## 当前状态

- 实现：已完成；
- GitHub 记录：已加入 Stage 49 模块与阶段文档；
- 真机验证：待执行；
- 下一门禁：仅在本阶段真机完整通过后，进入受限 Core 启动探测。
