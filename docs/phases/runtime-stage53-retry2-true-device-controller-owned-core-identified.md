# Runtime Stage 53 Retry 2 真机结果：已识别控制器持有 Core

## 结论

Stage 53 Retry 2 只读诊断通过，Runtime 与 `/proc` 状态分歧的根因已经缩小到 **实际 sing-box Core argv 与旧四参数精确匹配规则不同**。

Runtime 返回：

```text
STATUS=RUNNING
```

同时发现两个包含生产二进制或生产配置路径的候选：

1. Runtime 控制服务 PID `19373`：参数中携带二进制和配置路径，但 argv0 不是 sing-box；
2. 实际 sing-box Core PID `8011`：父 PID 为 `19373`，uid 为 `0`，argv0 为生产 sing-box 二进制，生产配置位于参数索引 `5`。

PID `8011` 是 Runtime 控制服务直接持有的 Core 进程。它不符合旧规则：

```text
<binary> run -c <config>
```

因此此前 `exactMatchingCoreCount=0` 是匹配契约过窄，不是 Core 不存在。

## 真机关键结果

- `ok=true`
- `preflightPassed=true`
- `shellUid=0`
- `productionConfigCheckPassed=true`
- Runtime 控制服务 PID：`19373`
- `controlServiceProcessAlive=true`
- `controlServiceOwnerValidated=true`
- `statusCommandSent=true`
- `statusRequestCount=1`
- `statusResponseStatus=RUNNING`
- `statusCorrelationMatched=true`
- `runtimeClaimsCoreRunning=true`
- `exactMatchingCoreCount=0`
- `looseBinaryCandidateCount=2`
- `looseConfigCandidateCount=2`
- `unionCoreCandidateCount=2`
- `stateDivergenceDetected=true`
- `processArgvContractMismatchDetected=true`
- `runtimeInternalProcessHandleDivergenceDetected=false`
- `readyForStateReconciliation=true`
- `nextAuthorizedOperation=runtime_stop_core_controller_owned_process_reconcile`

## 候选摘要

### PID 19373：Runtime 控制服务

- PPid：`1`
- uid：`0`
- state：`S`
- 参数数量：`9`
- binary 参数索引：`5`
- config 参数索引：`6`
- argv0 类型：`other`
- 旧精确参数匹配：`false`

该进程是控制服务自身，endpoint 和启动参数中携带生产二进制与配置路径，因此被宽松候选扫描命中，但不是 sing-box Core。

### PID 8011：实际 sing-box Core

- PPid：`19373`
- uid：`0`
- state：`S`
- 参数数量：`6`
- binary 参数索引：`0`
- config 参数索引：`5`
- argv0 类型：`expected_binary`
- 旧精确参数匹配：`false`

该进程满足新的控制器持有 Core 身份：

```text
PID != Runtime PID
PPid == Runtime PID
uid == 0
argv0 == production sing-box binary
production config exists in argv
state != Z
```

## 网络与安全状态

- `sbh-tun0` 不存在；
- IPv4/IPv6 规则 `8800–8815` 均为 `0`；
- IPv4/IPv6 路由表 `20240` 均为 `0`；
- 未发送 `START` 或 `STOP_CORE`；
- 未发送进程信号；
- 未修改 Runtime 文件、生产配置或 staging；
- 未修改 TUN、路由、DNS 或防火墙；
- 未执行节点连通性测试。

## 下一阶段

进入 Stage 53 Retry 3：

1. 要求恰好存在一个控制器持有 Core；
2. 先发送一次 `STATUS`，要求 Runtime 为运行态；
3. 通过已认证 Runtime 发送一次 `STOP_CORE`；
4. 精确确认所选 PID 已消失或不再具有原身份；
5. 确认控制器持有 Core 数量降为 `0`；
6. 确认 Runtime 控制服务继续运行；
7. 再次发送 `STATUS`，要求为停止态；
8. 发送一次 `PING`，要求 `PONG`；
9. 不发送 TERM/KILL，不修改任何 Runtime 文件。
