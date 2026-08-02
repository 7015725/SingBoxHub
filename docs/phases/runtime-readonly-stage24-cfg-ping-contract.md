# Runtime 只读适配阶段 24：CFG 感知的 PING 契约识别

- 日期：2026-08-02
- 分支：`agent/runtime-client-readonly-20260802`
- 模块集：`20260802.18`
- 入口最低版本：`21`
- 新增模块：`src/sbh_24_runtime_dex_cfg_contract.js`
- 模块 SHA-256：`3faf283736ee4b6e975e42cce08590f5f723a5e43b616f36dcb19614aba4b797`
- 状态：实现完成，真机验证待执行

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

第 23 阶段真机结果确认：

```text
LocalSocketAddress.name  <- client arg[0]
请求第 0 行              <- client arg[1]，服务端与 server arg[1] 比较
请求第 1 行              <- client arg[2]
请求第 2 行              <- client arg[3]，服务端与 PING 比较
客户端期望响应第 0 行    <- client arg[4]
客户端期望响应第 1 行    <- client arg[5]
客户端成功标记文件       <- client arg[6]
```

请求格式：

```text
token\n
correlation\n
command\n
```

响应格式候选：

```text
status\n
correlation\n
```

第 23 阶段仍未可靠解决的内容：

- `PING` 第一行响应是 `PONG`、`RUNNING`，还是根据核心进程状态二选一。
- 正常响应与异常响应写入点的准确控制流归属。
- `START`、停止路径和异常处理路径对寄存器状态的污染。

## 3. 实现内容

新增模块 `sbh_24_runtime_dex_cfg_contract.js`，主要实现：

### 3.1 DEX 结构解析

- `string_ids`
- `type_ids`
- `proto_ids`
- `field_ids`
- `method_ids`
- `class_defs`
- `class_data_item`
- `code_item`
- `try_item`
- `encoded_catch_handler_list`

### 3.2 指令和 CFG

支持本 Runtime 所需的主要指令格式：

- `move*`、`move-result*`
- `const*`、`const-string*`
- `aget-object`、`aput-object`
- `new-instance`、`new-array`、`filled-new-array`
- `iget/iput`、`sget/sput`
- `invoke-*` 35c/3rc
- `if-*`
- `goto*`
- `packed-switch`、`sparse-switch`
- 返回、抛出和异常处理器边

### 3.3 路径敏感抽象解释

每条路径独立维护：

- 寄存器符号值
- 静态字段值
- 数组元素
- 对象构造参数
- Reader/Writer 当前行号
- 分支条件
- 异常路径标记

在控制流汇合处不复用线性遍历留下的寄存器状态，避免第 23 阶段出现的类型不可能组合。

### 3.4 契约输出

模块输出包括：

- `requestSchema`
- `responseSchema`
- `tokenValidationEvidence`
- `commandValidationEvidence`
- `correlationEchoEvidence`
- `pingPathEvidence`
- `pingExpectedResponses`
- `pingSideEffectEvidence`
- `exceptionResponseEvidence`
- `clientCfg`
- `serverCfg`
- `pingResponseStatusResolved`
- `correlationEchoConfirmed`
- `readOnlyPingContractReady`

## 4. 安全边界

本阶段仅通过 root Shell 读取生产 JAR 中的 `classes.dex`，随后在 Rhino 内存中静态解析。

固定状态：

```json
{
  "classLoadingPerformed": false,
  "classInitializationPerformed": false,
  "classInstantiationPerformed": false,
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

即使静态契约完整，本阶段也不会连接 Runtime Socket。后续探测必须使用自建最小 `LocalSocket` 客户端，不能调用会创建成功标记文件的 `CoreClientMain.main()`。

## 5. 真机验证清单

首次运行入口 v21：

```json
{
  "entryVersion": 21,
  "moduleSetVersion": "20260802.18",
  "sync.updated": true,
  "sync.downloadedCount": 24,
  "app.runtimeDexCfgContract": "checking"
}
```

后台完成后再次运行，重点检查：

```text
runtimeDexCfgContract
runtimeDexCfgContractDetails.state
runtimeDexCfgContractDetails.clientCfg
runtimeDexCfgContractDetails.serverCfg
runtimeDexCfgContractDetails.requestSchema
runtimeDexCfgContractDetails.responseSchema
runtimeDexCfgContractDetails.tokenValidationConfirmed
runtimeDexCfgContractDetails.commandCarrierConfirmed
runtimeDexCfgContractDetails.correlationEchoConfirmed
runtimeDexCfgContractDetails.pingPathEvidence
runtimeDexCfgContractDetails.pingExpectedResponses
runtimeDexCfgContractDetails.pingSideEffectEvidence
runtimeDexCfgContractDetails.pingResponseStatusResolved
runtimeDexCfgContractDetails.readOnlyPingContractReady
runtimeDexCfgContractDetails.cfgDiagnostics
runtimeDexCfgContractDetails.error
```

理想结果：

```json
{
  "state": "readonly_ping_contract_ready",
  "framingState": "three_line_request_two_line_response_confirmed",
  "tokenValidationConfirmed": true,
  "commandCarrierConfirmed": true,
  "correlationEchoConfirmed": true,
  "pingResponseStatusResolved": true,
  "pingSideEffectFree": true,
  "readOnlyPingContractReady": true,
  "error": null
}
```

## 6. 下一阶段条件

只有以下条件全部成立，才允许进入第 25 阶段的“显式只读 PING dry-run 适配器”设计：

1. `readOnlyPingContractReady=true`
2. `pingExpectedResponses` 仅包含已确认安全状态，例如 `PONG`、`RUNNING`
3. `correlationEchoConfirmed=true`
4. `pingSideEffectEvidence=[]`
5. `cfgDiagnostics=[]`
6. 所有写操作门禁仍保持锁定

第 25 阶段仍需先实现 dry-run 请求构造和预览，不直接发送真实 Socket 报文。
