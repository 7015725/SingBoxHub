# Runtime Stage 46：生产配置提升前只读审计

## Stage 45 真机结论

Stage 45 的默认节点和 selector 临时配置预检已通过：

- 候选节点：51；
- `hysteria2`：18；
- `vless`：33；
- selector outbound 已加入；
- 默认节点匹配成功；
- `sing-box check` 退出码为 0；
- 临时配置已覆盖并删除；
- 生产配置、Runtime、Core、TUN 和路由均未修改。

## 目标

Stage 46 不进行任何 Runtime 写入，只为后续显式授权的原子部署建立可验证计划。

新增模块：

- `sbh_62_production_promotion_audit.js`
- `sbh_63_production_promotion_audit_ui.js`

## 审计流程

1. 重新执行 Stage 45 selector 临时配置检查；
2. 获取候选配置 SHA-256 和字节数；
3. 通过 ShortX Root Shell 只读检查 `config/runtime-tun.json`；
4. 检查目标目录、目标文件和备份目录是否为符号链接；
5. 获取当前生产配置 SHA-256、大小、mode、uid、gid 和设备号；
6. 检查 `sha256sum`、`stat` 和可用空间；
7. 生成同目录 staging 路径及备份路径计划；
8. 判断是否已经与候选配置一致，以及是否具备进入显式 staging 写入探测的条件。

## 计划

目标：

- `config/runtime-tun.json`

staging：

- `config/.runtime-tun.json.stage-<candidate-hash-prefix>`

备份：

- `config/backups/runtime-tun.<current-hash-prefix>.json`

最终替换计划：

- staging 与目标位于同一目录；
- 使用同文件系统 rename；
- 正式写入前必须完成 staging 写入、哈希、二进制检查、权限和 SELinux 元数据验证；
- 任一门禁失败时不得替换生产配置。

## 安全边界

Stage 46：

- 不创建 staging 文件；
- 不创建备份目录或备份文件；
- 不修改生产配置；
- 不修改 Runtime 文件或元数据；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、DNS 或防火墙；
- 不返回生产配置内容、候选 outbound 或凭据明文；
- 只返回哈希、文件元数据和部署计划；
- 后续 Runtime 写入仍需用户显式授权。

## 启动门禁

- `entryVersion=62`
- `moduleSetVersion=20260803.23`
- `expectedModuleCount=42`
- `productionPromotionAuditReady=true`
- `productionPromotionAuditReadOnly=true`
- `productionPromotionExplicitAuthorizationRequired=true`
- `productionPromotionRuntimeWriteEnabled=false`
- `productionPromotionConfigModified=false`

## 动作门禁

- `selectorPreflightPassed=true`
- `shellUid=0`
- `targetDirectoryExists=true`
- `targetDirectorySymlink=false`
- `targetSymlink=false`
- `sha256ToolAvailable=true`
- `statToolAvailable=true`
- `freeSpaceGatePassed=true`
- `readOnlyAuditPassed=true`
- `runtimeDirectoryWriteProbePerformed=false`
- `productionConfigModified=false`
- `runtimeFilesModified=false`
- `explicitWriteAuthorizationRequired=true`
