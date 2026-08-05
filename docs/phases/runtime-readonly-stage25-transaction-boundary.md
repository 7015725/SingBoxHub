# Runtime 只读适配阶段 25：单事务边界解析

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.19`
- 入口最低版本：`22`
- 新增模块：`src/sbh_25_runtime_transaction_contract.js`
- 模块 SHA-256：`2312b511c02d754f28105558f2c54e01b9a9da57d8041de58d87e2e78d322d44`
- 状态：真机验证通过；只读 PING 静态契约已就绪；真实 Socket dry-run 尚未启用

## 1. 阶段目标

第 24 阶段已确认三行请求、`PING` 命令和 `PONG` 响应，但 CFG 遍历跨越 `LocalServerSocket.accept()` 循环迭代，导致后续事务中的 START、STOP_CORE、STOP_RUNTIME 被错误归入当前 PING 路径。

本阶段新增独立二次解析模块，不改写第 23、24 阶段原始证据：

1. 固定单事务三行请求：token、correlation、command。
2. 固定单事务两行响应：status、correlation。
3. 确认 `PING -> PONG`。
4. 确认同一 Writer 在 `PONG` 后写出 `server.requestLine[1]` 并 flush。
5. 将引用 `server.readLine[3]` 及更高索引的副作用隔离为后续事务污染。
6. 判断当前 PING 事务是否无副作用。

## 2. 输入证据

第 24 阶段结果：

```json
{
  "requestSchema.lineCount": 3,
  "pingExpectedResponses": ["PONG"],
  "serverCfg.stateLimitReached": true,
  "responseSchema.lineCount": 6,
  "correlationEchoConfirmed": false,
  "pingSideEffectFree": false
}
```

响应累计为 6 行，且同一路径中同时出现 `server.readLine[2] == PING` 与 `server.readLine[5] == START/STOP_*`，证明旧分析跨越了多次连接事务。

第 23 阶段方法调用顺序提供结构证据：

```text
status write
newLine
server.requestLine[1] write
newLine
flush
```

## 3. 实现内容

`sbh_25_runtime_transaction_contract.js`：

- 消费 `runtimeDexCfgContract` 与 `runtimeDexProtocolDataflow`；
- 不重新读取 Runtime JAR，不执行 DEX；
- 校验请求三行固定来自 `arg:1`、`arg:2`、`arg:3`；
- 筛选只引用请求行 0～2 的 PONG 路径；
- 验证同一 Writer 的 `PONG -> newline -> requestLine[1] -> newline -> flush`；
- 将请求行 3 及以上条件下的副作用移入 `ignoredCrossTransactionSideEffects`；
- 输出当前事务副作用、事务边界、correlation 回显和门禁状态。

## 4. 安全边界

两次真机执行均保持：

```json
{
  "socketConnectionAttempted": false,
  "methodInvocationPerformed": false,
  "dexExecuted": false,
  "runtimeFilesModified": false,
  "authenticationValueRead": false,
  "authenticationValueUsed": false,
  "authenticationValueExposed": false,
  "adapterInvocationEnabled": false,
  "readyForExplicitDryRun": false,
  "writeOperationsLocked": true,
  "destructiveOperations": false
}
```

## 5. 真机验证结果

### 5.1 首次执行

```json
{
  "entryVersion": 22,
  "moduleSetVersion": "20260802.19",
  "sync.updated": true,
  "sync.downloadedCount": 25,
  "sync.warning": null,
  "runtimeTransactionContract": "checking"
}
```

结论：入口、模块清单和第 25 模块同步正常；首次返回为后台刷新尚未完成的启动快照。

### 5.2 第二次执行

```json
{
  "runtimeTransactionContract": "readonly_ping_contract_ready",
  "requestSchemaConfirmed": true,
  "responseSchemaConfirmed": true,
  "tokenValidationConfirmed": true,
  "commandCarrierConfirmed": true,
  "pingBranchConfirmed": true,
  "pingResponseStatusResolved": true,
  "pingExpectedResponses": ["PONG"],
  "correlationEchoConfirmed": true,
  "transactionBoundaryConfirmed": true,
  "loopBackStateIsolated": true,
  "pathStateLimitIsolated": true,
  "currentTransactionSideEffects": [],
  "pingSideEffectFree": true,
  "blockers": [],
  "readOnlyPingContractReady": true,
  "readyForExplicitDryRun": false,
  "error": null
}
```

Correlation 回显闭环证据：

```json
{
  "statusWritePc": 260,
  "statusValue": "PONG",
  "correlationWritePc": 266,
  "correlationValue": "server.requestLine[1]",
  "sameWriter": true,
  "newlineSeparated": true,
  "flushed": true,
  "requestLineIndex": 1,
  "responseLineIndex": 1
}
```

单事务协议最终确认：

```text
请求：
token\n
correlation\n
PING\n

响应：
PONG\n
correlation\n
```

## 6. 跨事务副作用隔离

当前 PING 事务：

```json
{
  "currentTransactionSideEffects": [],
  "pingSideEffectFree": true
}
```

被隔离的后续事务证据包括：

- `Process.destroy()`，PC 195，对应后续 `STOP_CORE` 条件；
- `Process.destroy()`，PC 228，对应后续 `STOP_RUNTIME` 条件；
- `Runtime.exec()`，PC 156，对应后续 `START` 条件；
- 同一 `Runtime.exec()` 因不同进程状态分支产生的重复静态路径。

这些路径均引用 `server.readLine[3]` 或 `server.readLine[5]`，不属于最初的三行 PING 事务。

## 7. 阶段结论

```json
{
  "protocolShapeResolved": true,
  "pingResponseResolved": true,
  "correlationEchoResolved": true,
  "transactionBoundaryResolved": true,
  "pingSideEffectFreeResolved": true,
  "readOnlyPingContractReady": true
}
```

第 25 阶段静态门禁通过。

## 8. 遗留一致性问题

`runtimeTransactionContract` 已将以下证据判定为通过：

```text
COMMAND_CARRIER_DECLARED
CORRELATION_FIELD_DECLARED
```

但旧的 `runtimeProtocolAdapterPlan.requiredEvidence` 和 `blockers` 数组仍保留两项未满足状态，同时 `adapterImplementationAllowed=true`。这是适配计划展示层的状态不一致，不影响第 25 模块的静态结论，但必须在下一阶段修正，避免后续 UI 或门禁读取旧数组。

## 9. 下一阶段门禁

下一阶段允许实现“脱敏 dry-run 请求构造与适配计划归一化”，但仍不得连接 Runtime Socket。

必须完成：

1. 将命令载体与 correlation 证据正式回写适配计划；
2. 清除旧的 `COMMAND_CARRIER_DECLARED`、`CORRELATION_FIELD_DECLARED` 阻断项；
3. 构造不含 token 原值的请求预览；
4. 固定命令只能是 `PING`；
5. 生成一次性 correlation 候选但不发送；
6. 输出预期响应 `PONG + correlation echo`；
7. 保持 `adapterInvocationEnabled=false`、`readyForExplicitDryRun=false`。

只有脱敏预览、旧阻断项归一化和安全字段全部通过，才允许进入真实只读 Socket dry-run 的单独授权阶段。
