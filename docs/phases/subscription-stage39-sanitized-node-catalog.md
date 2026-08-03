# Subscription Stage 39：脱敏节点目录

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：52
- 模块集：`20260803.13`
- 状态：待真机验证

## 阶段目标

在用户明确点击“解析入库”后，单次下载订阅并解析节点，将非敏感节点元数据写入客户端 SQLite，建立本地节点目录。

## 新增模块

- `src/sbh_46_subscription_node_catalog.js`
  - SQLite 表 `subscription_nodes`
  - 单次抓取、格式识别、节点解析、事务替换
  - 支持 sing-box JSON、Clash YAML、明文 URI 列表、Base64 URI 列表
  - URI 协议覆盖 SS、SSR、VMess、VLESS、Trojan、Hysteria/Hysteria2、TUIC、WireGuard、SOCKS、HTTP
- `src/sbh_44_subscription_crud_ui.js` v3
  - 新增“解析入库”按钮
  - 新增本地节点目录展示

## SQLite 边界

只保存：

- 来源订阅 ID
- 节点名称
- 协议
- 服务器和端口
- TLS 标记
- 传输类型
- 非敏感指纹

不保存：

- 密码
- UUID
- Private key / Public key
- token
- 完整节点 URI
- 原始订阅正文

因此所有节点均标记为：

- `credential_state=not_persisted`
- `runtime_usable=false`

## 安全边界

- 仅用户点击触发，不自动抓取、不自动重试。
- 响应体最大 4 MiB、节点最多 2000 个、跳转最多 3 次。
- 拒绝本机、私网、链路本地、组播地址和 HTTPS 降级跳转。
- 解析成功后以事务替换该订阅的节点目录；解析失败时保留旧节点目录。
- 删除订阅时通过 SQLite trigger 删除对应节点元数据。
- 不写 Runtime 配置，不启动 Core/TUN，不修改路由。

## 真机门禁

1. `moduleSetVersion=20260803.13` 严格激活，无 fallback 和 warning。
2. `subscriptionNodeCatalogReady=true`。
3. 对实际订阅执行“解析入库”，返回 `storedNodeCount > 0`。
4. 节点目录只显示脱敏元数据和“凭据未保存”。
5. 删除订阅后对应节点目录自动删除。
6. Runtime、Core、TUN、路由和配置写操作保持为 false。

## 后续阶段

Stage 39 通过后，下一阶段单独设计 Android Keystore 凭据保险库；在凭据安全存储完成前，不生成可运行 Runtime 配置。
