# Credential Stage 41：真实订阅凭据加密入库

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：54
- 模块集：`20260803.15`
- 模块数：29
- 固定模块提交：`c1bb3d5ff4f88d6e420d4dd83ec0c10300185d82`
- 状态：待真机验证

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

## 真机门禁

1. `entryVersion=54`；
2. `moduleSetVersion=20260803.15`，29 个模块严格激活；
3. `subscriptionCredentialImportReady=true`；
4. `subscriptionCredentialImportUiReady=true`；
5. 先执行“解析入库”，再执行“安全入库”；
6. 结果 `ok=true`、`encryptedCredentialCount>0`、`matchedNodeCount>0`；
7. `plaintextCredentialPersisted=false`；
8. `plaintextCredentialReturned=false`；
9. `rawBodyPersisted=false`；
10. `runtimeUsable=false`；
11. Runtime、配置、Core、TUN 和路由修改标志全部为 `false`；
12. 删除测试订阅后，关联凭据记录数量恢复为 0。

## 后续阶段

Stage 41 通过后，下一阶段只生成内存中的 sing-box 出站配置预览并执行结构校验。未经再次明确授权，不写生产 Runtime 配置，也不启动 Core/TUN。
