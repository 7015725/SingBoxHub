# Credential Stage 40：Android Keystore 凭据保险库探测

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：53
- 模块集：`20260803.14`
- 状态：待真机验证

## 阶段目标

验证 ShortX / Rhino ES5 环境下 Android Keystore 的 AES-GCM 密钥生成、客户端 SQLite 密文存储、解密往返与删除清理能力。

本阶段只使用随机测试文本，不导入或保存真实订阅凭据。

## 新增模块

- `src/sbh_47_credential_vault.js`
  - Android Keystore AES-256-GCM 密钥
  - 随机 IV
  - AAD 绑定记录键和用途
  - SQLite 表 `credential_vault`
  - 手动自检：写入密文、解密比对、删除测试记录
- `src/sbh_48_credential_vault_ui.js`
  - 节点页底部增加保险库状态卡片
  - 增加“运行保险库自检”按钮

## SQLite 表

只保存：

- `record_key`
- `purpose`
- `iv_b64`
- `cipher_b64`
- `aad_sha256`
- 创建和更新时间

不包含：

- plaintext
- password
- UUID
- token
- private key
- 真实订阅凭据

## 密钥参数

- Provider：`AndroidKeyStore`
- 算法：AES
- 模式：GCM
- Padding：NoPadding
- 密钥长度：256 bit
- GCM tag：128 bit
- `randomizedEncryptionRequired=true`
- Android 9 及以上尝试启用 `unlockedDeviceRequired=true`
- 不要求每次用户生物识别或锁屏认证，以保留 ShortX 后台自动化兼容性

## 重要隔离边界

Android Keystore 密钥按 Android Linux UID 隔离。当前 ShortX 运行环境已知为 `uid=1000`，因此该密钥不是 SingBoxHub 独占应用 UID 的私有密钥。

Stage 40 必须先返回：

- `credentialVaultProcessUid`
- `credentialVaultProcessPackage`
- `credentialVaultInsideSecureHardware`
- `credentialVaultIsolationScope=android_linux_uid`

在确认该边界前，不允许导入真实订阅密码、UUID、token 或私钥。

## 手动自检

点击“运行保险库自检”后：

1. 生成随机测试文本；
2. 使用 Keystore AES-GCM 加密；
3. 只将 IV、密文和 AAD 哈希写入 SQLite；
4. 从 SQLite 读取密文并解密；
5. 仅在内存中比较结果；
6. 删除测试记录；
7. 确认数据库无明文字段且测试记录已不存在。

自检结果不返回测试明文，只返回明文 SHA-256、密文 SHA-256 和布尔门禁。

## 安全边界

- 不导入真实节点凭据；
- 不自动运行自检；
- 不向日志或 UI 输出明文；
- 不生成 Runtime 配置；
- 不修改 Runtime 文件；
- 不启动 Core/TUN；
- 不修改路由；
- 不访问订阅网络。

## 真机门禁

1. `moduleSetVersion=20260803.14` 严格激活，无 fallback 和 warning；
2. `credentialVaultReady=true`；
3. `credentialVaultAliasExists=true`；
4. `credentialVaultPlaintextColumnPresent=false`；
5. 点击自检后 `ok=true`；
6. `ciphertextDiffersFromPlaintext=true`；
7. `roundTripMatched=true`；
8. `testRecordDeleted=true`；
9. `absentAfterDelete=true`；
10. `realCredentialsStored=false`；
11. Runtime、Core、TUN、路由和配置写操作保持为 false。

## 后续阶段

只有在 Stage 40 真机通过并确认 UID 隔离边界后，才设计 Stage 41 的真实订阅凭据加密导入。若 `uid=1000` 的共享隔离范围不可接受，则 Stage 41 必须改用额外用户口令派生密钥或独立应用 UID，而不是直接保存真实凭据。
