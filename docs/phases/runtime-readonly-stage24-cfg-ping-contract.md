# Runtime 只读适配阶段 24：CFG 感知的 PING 契约识别

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.18`
- 入口最低版本：`21`
- 新增模块：`src/sbh_24_runtime_dex_cfg_contract.js`
- 模块 SHA-256：`3faf283736ee4b6e975e42cce08590f5f723a5e43b616f36dcb19614aba4b797`
- 状态：真机验证完成；静态协议主体识别通过；显式 dry-run 门禁未通过

## 1. 阶段目标

第 23 阶段已经确认 Runtime 使用 Android `LocalSocket`，并还原出三行请求和两行响应的结构，但线性寄存器传播在控制流汇合处发生状态污染，尚不能可靠确定 `PING` 的第一行响应。

本阶段改用 CFG 感知、路径敏感的 DEX 静态分析，目标是：

1. 分离 `if-*`、`goto`、异常处理器和正常顺序路径。
2. 追踪静态字段中的 `Process` 状态。
3. 解析每条响应写入路径的状态字符串。
4. 确认请求第二行是否在响应第二行原样回显。
5. 确认 `PING` 路径不触发 `Runtime.exec()`、`Process.destroy()` 或 Runtime 文件写入。
6. 在不连接 Socket 的前提下判断只读 PING 契约是否具备实现条件。

## 2. 已确认的输入证据

第 23 阶段确认客户端固定发送：

```text
第 0 行：token        <- client arg[1]
第 1 行：correlation  <- client arg[2]
第 2 行：command      <- client arg[3]
```

Socket 名称来自 `client arg[0]`。客户端读取两行响应，并使用 `client arg[4]`、`client arg[5]` 比较响应状态和关联值；直接调用 `CoreClientMain.main()` 会创建 `client arg[6]` 指定的成功标记文件，因此后续禁止复用该入口。

## 3. 实现内容

模块 `sbh_24_runtime_dex_cfg_contract.js` 实现：

- DEX 字符串、类型、字段、方法、类、代码项和异常处理表解析；
- `move*`、`const*`、数组、对象、字段、`invoke-*`、分支、跳转和 switch 指令解析；
- 路径独立的寄存器、静态字段、数组、对象、Reader/Writer 行号和条件状态；
- 请求、响应、token、command、correlation、PING、START、异常响应和副作用证据输出；
- 固定只读门禁，不连接 Socket、不执行 DEX、不读取 token 值。

## 4. 安全边界

真机两次执行均保持：

```json
{
  "socketConnectionAttempted": false,
  "methodInvocationPerformed": false,
  "dexExecuted": false,
  "temporaryFilesCreated": false,
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
  "entryVersion": 21,
  "moduleSetVersion": "20260802.18",
  "sync.updated": true,
  "sync.downloadedCount": 24,
  "sync.warning": null,
  "runtimeDexCfgContract": "checking"
}
```

结论：入口、清单和第 24 模块同步正常；首次返回为后台分析尚未完成的启动快照。

### 5.2 第二次执行

```json
{
  "runtimeDexCfgContract": "cfg_protocol_contract_identified",
  "cfgEvidenceAvailable": true,
  "tokenValidationConfirmed": true,
  "commandCarrierConfirmed": true,
  "oneRequestOneResponseConfirmed": true,
  "pingBranchConfirmed": true,
  "pingResponseStatusResolved": true,
  "pingExpectedResponses": ["PONG"],
  "correlationEchoConfirmed": false,
  "pingSideEffectFree": false,
  "readOnlyPingContractReady": false,
  "readyForExplicitDryRun": false,
  "error": null
}
```

已确认请求结构：

```text
token\n
correlation\n
command\n
```

已确认字段映射：

```text
socketName  <- client arg[0]
token       <- client arg[1] -> request line 0
correlation <- client arg[2] -> request line 1
command     <- client arg[3] -> request line 2
```

已确认 `PING` 第一行响应：

```text
PONG
```

### 5.3 当前阻断项

```text
PATH_STATE_LIMIT_REACHED
CORRELATION_ECHO_NOT_CONFIRMED
PING_PATH_SIDE_EFFECT_FOUND
```

分析器输出的 `PING` 副作用路径包含如下不可能属于同一请求的连续条件：

```text
当前 requestLine[2] == PING
后续 requestLine[5] == START / STOP_CORE / STOP_RUNTIME
```

同时响应模式被累计为 6 行，而实际协议单次事务应为两行。这表明服务端 `accept()` 循环进入下一次连接后，分析器仍保留上一事务的 `PING=true` 条件，并把后续连接中的 `Runtime.exec()`、`Process.destroy()` 错误归入初始 PING 路径。

因此：

- `PONG` 结论可信；
- token 和 command 行号结论可信；
- `PING_PATH_SIDE_EFFECT_FOUND` 当前属于高概率静态分析误报，不能当作真实 Runtime 副作用；
- correlation 第二行回显已有第 23 阶段的写入证据，但第 24 阶段尚未在单事务边界内闭环；
- 在误报消除前，不允许真实 Socket dry-run。

## 6. 阶段结论

第 24 阶段达到“协议主体识别通过”，但未达到“只读 PING 契约可执行”。

```json
{
  "protocolShapeResolved": true,
  "pingResponseResolved": true,
  "transactionBoundaryResolved": false,
  "correlationEchoResolved": false,
  "pingSideEffectFreeResolved": false,
  "readOnlyPingContractReady": false
}
```

## 7. 下一阶段门禁

下一阶段不是实际 Socket dry-run，而是“单连接事务边界与循环摘要修正”。必须完成：

1. 将 `LocalServerSocket.accept()` 的每次循环迭代视为独立事务；
2. 在循环回边清除 Reader、Writer、请求行、响应行和分支条件；
3. 对单次请求限定最多 3 行读取、2 行写入；
4. 单独验证 `PING -> PONG + requestLine[1]`；
5. 排除后续 START、STOP_CORE、STOP_RUNTIME 路径对 PING 的污染；
6. 消除 `PATH_STATE_LIMIT_REACHED`；
7. 只有以下结果全部成立才允许设计显式 dry-run：

```json
{
  "correlationEchoConfirmed": true,
  "pingSideEffectEvidence": [],
  "pingSideEffectFree": true,
  "cfgDiagnostics": [],
  "readOnlyPingContractReady": true
}
```

后续阶段仍只允许静态分析，不读取 token 值、不连接 Runtime Socket、不调用 `CoreClientMain.main()`。
