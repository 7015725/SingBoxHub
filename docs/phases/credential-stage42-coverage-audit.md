# Credential Stage 42：凭据覆盖率审计

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：55
- 模块集：`20260803.16`
- 状态：待真机验证

## 背景

Stage 41 真机结果显示：

- 本地节点：51
- Android Keystore 保险库记录：50
- 安全入库操作成功

同时 Stage 40 保险库状态仍固定返回 `realCredentialsStored=false`，与真实密文记录不一致。

## 阶段目标

新增只读覆盖率审计，不重新下载订阅、不解密真实凭据、不修改节点或保险库记录：

- 核对本地节点数；
- 核对标记为 `encrypted_vault` 的节点数；
- 核对 SQLite 凭据链接数；
- 核对每条链接对应的 Keystore 密文是否存在；
- 定位缺失凭据节点的名称、协议、服务器、端口和来源订阅；
- 修正 `realCredentialsStored`、保险库记录数及覆盖率状态字段。

## 新增模块

- `src/sbh_51_credential_coverage_audit.js`
- `src/sbh_52_credential_coverage_audit_ui.js`

## 输出字段

- `totalNodeCount`
- `encryptedNodeCount`
- `linkedCredentialCount`
- `vaultRowCount`
- `missingCredentialNodeCount`
- `orphanCredentialLinkCount`
- `linkWithoutVaultCount`
- `coveragePercent`
- `coverageComplete`
- `missingByProtocol`
- `missingNodes`

## 安全边界

- 不读取或解密任何真实凭据；
- 不返回密码、UUID、Token、密钥或完整节点 URI；
- 不访问订阅网络；
- 不写客户端数据库；
- 不写 Runtime 配置；
- 不启动 Core/TUN；
- 不修改路由或 DNS。

## 真机门禁

1. `moduleSetVersion=20260803.16` 严格激活；
2. `credentialCoverageAuditReady=true`；
3. `credentialVaultRealCredentialsStored=true`；
4. 页面显示凭据覆盖率审计卡片；
5. 审计结果明确指出 51/50 差异对应的节点和协议；
6. `plaintextCredentialRead=false`；
7. Runtime、Core、TUN、路由和配置写操作保持为 false。

## 后续

根据缺失节点类型决定：

- 补充对应协议解析器；或
- 将无需凭据的节点类型排除在覆盖率分母之外。

覆盖率规则稳定后，才进入 Runtime 配置只读生成预览。
