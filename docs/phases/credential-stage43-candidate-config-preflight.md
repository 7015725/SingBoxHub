# Credential Stage 43：候选配置结构预检

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：56
- 模块集：`20260803.17`
- 模块数：33
- 状态：待真机验证

## 前置结果

Stage 42 真机通过：

- 本地节点：51
- 保险库凭据：51
- 覆盖率：100%
- 缺失凭据：0
- 孤立链接：0
- 链接无密文：0
- 明文读取：false

## 阶段目标

在用户点击按钮后，逐条从 Android Keystore 保险库解密节点凭据，在内存中构造候选 sing-box outbound，并执行结构完整性检查。

本阶段不调用 sing-box 二进制，不生成或持久化完整配置，不写生产 Runtime。

## 新增模块

- `src/sbh_53_candidate_config_preflight.js`
  - 批量读取节点与保险库链接
  - 逐条解密凭据
  - 支持 sing-box outbound、Clash proxy、VMess URI、SS URI、通用 URI
  - 构造候选 outbound
  - 检查服务器、端口和协议必需认证字段
  - 返回协议统计、有效数、无效数、脱敏错误及候选集合 SHA-256
- `src/sbh_54_candidate_config_preflight_ui.js`
  - 节点页新增“候选配置结构预检”卡片
  - 单次手动触发
  - 结果只显示脱敏统计

## 安全边界

- 必须先满足凭据覆盖率 100%。
- 只在用户点击后执行，不自动运行、不自动重试。
- 不返回候选 outbound 对象。
- 不返回密码、UUID、Token、密钥或完整 URI。
- 单节点解析失败只返回固定错误码，避免 Java URI 异常回显原始凭据。
- 不持久化候选配置。
- 不访问订阅网络。
- 不调用 sing-box 二进制。
- 不写 Runtime 文件或配置。
- 不启动 Core/TUN，不修改路由或 DNS。
- JavaScript 字符串无法保证物理内存清零，因此只承诺及时释放引用，不宣称完整内存零化。

## 真机门禁

1. `entryVersion=56`。
2. `moduleSetVersion=20260803.17`。
3. 33 个模块严格激活，无 fallback、无 warning。
4. `candidateConfigPreflightReady=true`。
5. 点击“运行候选配置预检”。
6. `decryptedCredentialCount=51`。
7. `candidateBuiltCount=51`。
8. `structurallyValidCount + unsupportedTypeCount + invalidCandidateCount = 51`。
9. 结果中不得出现真实凭据或候选对象。
10. `candidateConfigPersisted=false`、`singBoxBinaryCheckInvoked=false`、`runtimeFilesModified=false`、`configModified=false`。

## 后续阶段

根据 Stage 43 的协议统计和待处理项补齐转换器。全部候选结构有效后，再单独设计客户端临时文件与 sing-box `check` 的授权边界；在获得新授权前不写任何 Runtime 配置。