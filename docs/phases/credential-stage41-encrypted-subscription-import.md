# Credential Stage 41：真实订阅凭据加密入库

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：54
- 模块集：`20260803.15`
- 模块数：29
- 固定模块提交：`c1bb3d5ff4f88d6e420d4dd83ec0c10300185d82`
- 状态：真机通过，覆盖率差异转 Stage 42 审计

## 真机结果

启动门禁通过：

- `entryVersion=54`
- `moduleSetVersion=20260803.15`
- 29 个模块严格激活；
- `subscriptionCredentialImportReady=true`
- `subscriptionCredentialImportUiReady=true`
- `subscriptionCredentialPlaintextPersisted=false`
- `subscriptionCredentialPlaintextReturned=false`
- `subscriptionCredentialsRuntimeUsable=false`
- Runtime、配置、Core、TUN 和路由修改标志全部为 `false`。

实际订阅执行“安全入库”后，界面确认：

- 本地节点：51；
- Android Keystore 保险库密文记录：50；
- 状态提示“凭据已加密写入保险库”；
- SQLite 保险库表只有 `record_key`、`purpose`、`iv_b64`、`cipher_b64`、`aad_sha256` 和时间戳字段；
- 无明文字段。

51 个节点与 50 条凭据之间的差异不在 Stage 41 中猜测或自动修复，转交 Stage 42 通过只读 SQL 与 Keystore 记录存在性审计定位。

## 前置门禁

Stage 40 Android Keystore 保险库已完成真机自检：

- AES-GCM 密文与明文不同；
- 加密、解密往返一致；
- 测试记录已删除且删除后不可查询；
- SQLite 无明文字段；
- 未保存真实凭据；
- Runtime、配置、Core、TUN 和路由均未修改。

当前 Keystore 隔离范围为 Android Linux UID。ShortX 进程环境为 `uid=1000`、包名 `android`，不是独立应用 UID。

## 阶段目标

在用户明确点击“安全入库”后，单次抓取实际订阅，将节点敏感字段直接加密写入 Android Keystore 保险库，并通过不含明文的 SQLite 映射关联到 Stage 39 的脱敏节点目录。

## 新增模块

- `src/sbh_49_subscription_credential_import.js`
  - 单次手动订阅抓取；
  - 复用 Stage 39 节点指纹规则；
  - 支持 URI 列表、Base64 URI 列表、sing-box JSON 和 Clash YAML；
  - 将完整敏感载荷封装后调用 `SBH.credentialVault.putText()`；
  - 使用记录键 `nodecred:<subscriptionId>:<fingerprint>`；
  - SQLite 只保存订阅 ID、节点指纹、保险库记录键和来源格式；
  - 节点元数据标记 `credential_state=encrypted_vault`；
  - `runtime_usable` 继续保持 `false`。
- `src/sbh_50_subscription_credential_import_ui.js`
  - 在节点页追加“订阅凭据安全入库”卡片；
  - 每条订阅提供“安全入库”按钮；
  - 只显示计数、格式、脱敏来源和安全状态；
  - 不显示明文凭据。

## 两阶段提交

1. 在内存中下载并解析订阅；
2. 将每个匹配节点的敏感载荷使用 Android Keystore AES-GCM 加密；
3. 将保险库记录键映射写入客户端 SQLite；
4. 数据库提交成功后删除不再使用的旧保险库记录；
5. 任一步失败时，不替换现有节点目录和映射；新建但未提交的保险库记录会清理。

## 前置操作

首次为某个订阅执行 Stage 41 前，必须先在 Stage 39 页面点击“解析入库”，建立脱敏节点目录。Stage 41 只为已存在并且指纹匹配的目录节点保存加密凭据，防止凭据和错误节点关联。

## 明文边界

不会写入 SQLite、日志、界面、启动 JSON 或返回 JSON 的内容：

- 密码；
- UUID；
- Token；
- Private key / Public key；
- 完整节点 URI；
- 原始订阅正文；
- 解密后的凭据对象。

仅保存：

- Android Keystore AES-GCM 密文和随机 IV；
- 节点指纹到保险库记录键的映射；
- 来源格式和时间戳。

## 生命周期清理

- 重新执行 Stage 39“解析入库”时，旧凭据映射和对应保险库记录会清理，避免元数据与凭据失配；
- 删除订阅时，关联保险库记录会一并删除；
- Stage 41 成功更新后，旧版本中不再使用的保险库记录会在数据库提交成功后清理。

## 安全边界

- 仅用户点击触发；
- 不自动刷新、不自动重试；
- 不持久化订阅正文；
- 不返回明文凭据；
- 不生成或写入 Runtime 配置；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、DNS、防火墙；
- 节点继续标记 `runtime_usable=false`。

## 后续阶段

Stage 42 先完成凭据覆盖率审计和状态修正。覆盖率规则稳定前，不生成 Runtime 配置预览。
