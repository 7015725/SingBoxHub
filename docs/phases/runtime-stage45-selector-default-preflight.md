# Runtime Stage 45：本地默认节点与 selector 配置预检

## 目标

在不写入生产 Runtime 配置、不启动 Core/TUN 的前提下，完成：

1. 从 51 个已加密且已通过结构检查的节点中选择默认节点；
2. 将默认选择作为客户端 SQLite 设置持久化；
3. 构建包含 51 个节点 outbound 的 `selector`；
4. 通过已验证的 Root ShortX Shell 通道执行临时 `sing-box check`；
5. 检查完成后覆盖并删除临时配置。

## selector 结构

预检配置在原 51 个节点 outbound 之前加入：

```json
{
  "type": "selector",
  "tag": "proxy-selector",
  "outbounds": ["node-s..."],
  "default": "node-s...",
  "interrupt_exist_connections": false
}
```

`outbounds` 必须包含全部候选节点标签，`default` 必须与本地选择的节点标签一致。

## 默认节点持久化

- 设置键：`selector_default_node_key`
- 保存位置：客户端 `singboxhub.db` 的 `settings` 表
- 保存值：`subscriptionId:fingerprint`
- 不保存密码、UUID、Token、私钥、完整节点 URI 或候选 outbound
- 已保存节点被删除或失效时，回退到当前目录中的第一个节点并更新设置

## 模块

- `sbh_60_selector_default_preflight.js`
- `sbh_61_selector_default_preflight_ui.js`

UI 支持：

- 上一个 / 下一个；
- 前 10 个 / 后 10 个；
- 设为默认节点；
- 运行 selector 配置预检。

## 临时序列化作用域

Stage 44 的候选配置构造器为闭包内部实现。Stage 45 在单次预检期间安装受限的 `JSON.stringify` 作用域钩子：

- 仅匹配数量与当前节点数完全一致的候选 `outbounds` 配置；
- 所有候选 tag 必须以 `node-s` 开头；
- 原配置不能已经包含 selector；
- 只复制配置并在副本中加入 selector，不修改候选对象本身；
- 同一时间只允许一个 selector 预检；
- 回调结束后恢复原始 `JSON.stringify`；
- 45 秒 watchdog 负责异常情况下恢复；
- 未观察到 selector 注入时强制判定失败。

## 二进制检查通道

继续使用 Stage 44 已通过的执行链：

```text
ShortX ShellCommand
→ shortx.executeAction()
→ uid=0
→ sing-box check -c <客户端临时配置>
```

明确禁用：

- Java `ProcessBuilder`；
- Java `File.isFile()/canExecute()` 二进制预检查；
- 临时权限桥；
- `su` 二次提权。

## 安全边界

- 默认节点选择只修改客户端 SQLite；
- selector 配置只存在于客户端临时文件；
- 不修改 `/SingBoxHub/config` 生产配置；
- 不修改 Runtime 文件；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、DNS、防火墙或系统代理；
- 不返回候选 outbound；
- 不返回或持久化凭据明文；
- 临时配置完成后覆盖并删除。

## 启动门禁

- `selectorDefaultPreflightReady=true`
- `selectorDefaultNodeCount=51`
- `selectorDefaultNodePersisted=true`
- `selectorOutboundTag=proxy-selector`
- `selectorDefaultPreflightUiReady=true`
- `selectorDefaultCheckButtonReady=true`
- `selectorPreflightProductionConfigModified=false`
- `selectorPreflightRuntimeUsable=false`

## 动作通过门禁

- `selectorOutboundIncluded=true`
- `selectorDefaultMatched=true`
- `selectorCandidateTagCount=51`
- `selectedNode.selected=true`
- `shortxExecuteActionUsed=true`
- `shellUid=0`
- `singBoxBinaryCheckInvoked=true`
- `singBoxExitCode=0`
- `singBoxCheckPassed=true`
- `temporaryConfigDeleted=true`
- `selectorConfigPersisted=false`
- `productionConfigModified=false`
- `runtimeFilesModified=false`
- `coreStartInvoked=false`
- `tunCreated=false`
- `routeModified=false`

Stage 45 通过后，才讨论生产 Runtime 配置提升及其单独授权边界。
