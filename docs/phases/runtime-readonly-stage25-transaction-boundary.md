# Runtime 只读适配阶段 25：单事务边界解析

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.19`
- 入口最低版本：`22`
- 新增模块：`src/sbh_25_runtime_transaction_contract.js`
- 模块 SHA-256：`2312b511c02d754f28105558f2c54e01b9a9da57d8041de58d87e2e78d322d44`
- 状态：实现完成，真机验证待执行

## 1. 阶段目标

第 24 阶段已确认三行请求、`PING` 命令和 `PONG` 响应，但 CFG 遍历跨越 `LocalServerSocket.accept()` 循环迭代，导致后续事务中的 START、STOP_CORE、STOP_RUNTIME 被错误归入当前 PING 路径。

本阶段不修改第 24 阶段原始证据，而新增独立二次解析模块：

1. 将请求固定为单事务三行：token、correlation、command。
2. 将响应固定为单事务两行：status、correlation。
3. 以第 24 阶段路径证据确认 `PING -> PONG`。
4. 结合第 23 阶段方法调用顺序确认同一 Writer 在 `PONG` 后写出 `server.requestLine[1]` 并 flush。
5. 将条件中出现 `server.readLine[3]` 及更高索引的副作用分类为跨事务污染。
6. 只将请求行 0～2 条件下的副作用视为当前事务副作用。
7. 在不连接 Socket、不读取 token 值的前提下判断只读 PING 契约是否完整。

## 2. 输入证据

第 24 阶段真机结果：

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

响应累计为 6 行，以及副作用条件同时出现 `server.readLine[2] == PING` 和 `server.readLine[5] == START/STOP_*`，证明原分析跨越多次连接事务。

第 23 阶段调用顺序提供结构证据：

```text
status write
newLine
server.requestLine[1] write
newLine
flush
```

第 24 阶段已将该 status write 路径解析为 `PONG`。

## 3. 实现内容

新增 `sbh_25_runtime_transaction_contract.js`：

- 消费 `runtimeDexCfgContract` 与 `runtimeDexProtocolDataflow`；
- 不重新读取 Runtime JAR，不执行 DEX；
- 校验三行请求参数固定为 `arg:1`、`arg:2`、`arg:3`；
- 从第 24 阶段 `pingPathEvidence` 中筛选仅引用请求行 0～2 的 PONG 路径；
- 从第 23 阶段 `serverCallTrace` 中验证同一 Writer 的 `PONG -> newline -> requestLine[1] -> newline -> flush`；
- 将引用请求行 3 及以上的副作用移入 `ignoredCrossTransactionSideEffects`；
- 输出当前事务副作用、事务边界、correlation 回显和门禁状态。

主要输出：

```text
runtimeTransactionContract
runtimeTransactionContractDetails.requestSchemaConfirmed
runtimeTransactionContractDetails.responseSchemaConfirmed
runtimeTransactionContractDetails.correlationEchoConfirmed
runtimeTransactionContractDetails.transactionBoundaryConfirmed
runtimeTransactionContractDetails.loopBackStateIsolated
runtimeTransactionContractDetails.pathStateLimitIsolated
runtimeTransactionContractDetails.currentTransactionSideEffects
runtimeTransactionContractDetails.ignoredCrossTransactionSideEffects
runtimeTransactionContractDetails.pingSideEffectFree
runtimeTransactionContractDetails.readOnlyPingContractReady
runtimeTransactionContractDetails.blockers
```

## 4. 安全边界

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

即使本阶段门禁通过，也只允许进入 dry-run 请求构造设计，不发送真实 Socket 报文。

## 5. 预期真机结果

首次执行 v22：

```json
{
  "entryVersion": 22,
  "moduleSetVersion": "20260802.19",
  "sync.updated": true,
  "sync.downloadedCount": 25,
  "runtimeTransactionContract": "checking"
}
```

后台完成后第二次执行目标：

```json
{
  "runtimeTransactionContract": "readonly_ping_contract_ready",
  "requestSchemaConfirmed": true,
  "responseSchemaConfirmed": true,
  "tokenValidationConfirmed": true,
  "commandCarrierConfirmed": true,
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

## 6. 回滚点

删除第 25 模块并恢复：

```text
moduleSetVersion = 20260802.18
entryMinVersion = 21
moduleCount = 24
```

第 23、24 阶段原始静态证据不修改。

## 7. 下一阶段门禁

只有 `readOnlyPingContractReady=true`、`currentTransactionSideEffects=[]` 且 `blockers=[]` 时，才允许进入显式 dry-run 请求构造阶段。下一阶段仍先输出脱敏请求预览，不读取或展示 token 原值，也不连接 Runtime Socket。
