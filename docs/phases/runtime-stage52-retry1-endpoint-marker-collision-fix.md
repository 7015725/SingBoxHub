# Runtime Stage 52 Retry 1：修复 endpoint marker 冲突

## 输入状态

Stage 52 真机结果已确认：

- 前置门禁通过；
- stale endpoint 已识别；
- 新控制服务 PID `11777` 已派发；
- endpoint 为 `0600`、root 所有，字节数 `639`；
- 恢复审计已创建；
- JavaScript 汇总层误读前置阶段的 `EP_DATA=none`；
- 返回 `CONTROL_SERVICE_ENDPOINT_DATA_MISSING`；
- 本次 PID 已精确回滚停止；
- sing-box Core、TUN、规则和路由均未启用。

## 授权

- 授权 ID：`stage52-retry1-runtime-control-service-recovery-user-authorized-20260805`
- 来源核对授权：`stage51-retry1-stale-core-state-reconcile-user-authorized-20260804`
- 自动重试：禁用
- Runtime 控制服务恢复：启用
- 认证 PING：最多一次
- sing-box Core 启停：禁用
- TUN、路由、DNS、防火墙与节点连通性测试：禁用

## 实现

新增模块：

- `src/sbh_75_runtime_control_service_recovery_retry1.js`
- 模块内部版本：`runtimeControlServiceRecoveryRetry1=1`
- 模块 SHA-256：`61b864a76cbc2fdd6c4ed898402aed80f554745cdec66cf5c9e61af67d2f7615`
- 测试入口：`SingBoxHub_Stage52_Runtime控制服务恢复重试1.txt`
- 入口版本：`75`
- 入口 SHA-256：`225f1a15560468efc59764fc6ec5b853e71a82dda917547fb60fcd655da302f8`
- 模块集：`20260803.22+stage52-retry1-endpoint-marker-fix-inline`

## 修复内容

### 1. marker 采用最后值

旧实现使用首次正则匹配。Retry 1 将输出按行拆分，并从末尾向前查找：

```javascript
function marker(raw, name) {
    var lines = String(raw || "").split(/\r?\n/);
    var prefix = "__SBH_" + String(name) + "__=";
    var index;
    var line;

    for (index = lines.length - 1; index >= 0; index -= 1) {
        line = String(lines[index]);
        if (line.indexOf(prefix) === 0) {
            return line.substring(prefix.length);
        }
    }
    return null;
}
```

重复 marker 出现时，后续阶段的值覆盖前置阶段值。

### 2. 各阶段输出独立保存

新增：

- `preflightRaw`
- `dispatchRaw`
- `reconcileRaw`

控制逻辑不再依赖混合输出选择关键 endpoint 数据。

### 3. endpoint 数据按来源读取

- 复用既有服务：只从 `preflightRaw` 读取 `EP_PID` 和 `EP_DATA`；
- 启动新服务：只从 `reconcileRaw` 读取 `PID`、`RECOVERY_OK` 和 `EP_DATA`。

新增结果字段：

```text
markerResolutionMode=phase_scoped_reverse_line_scan
endpointDataSource=preflight_reused_endpoint|reconcile_published_endpoint
endpointDataObserved=true|false
```

## 运行边界

Retry 1 沿用 Stage 52 的前置门禁、双 `setsid` 启动、endpoint 原子发布、恢复审计、一次认证 PING 和精确失败回滚。

不扩大任何操作范围：

- 不启动或停止 sing-box Core；
- 不创建 `sbh-tun0`；
- 不修改规则 `8800–8815`；
- 不修改路由表 `20240`；
- 不修改 DNS 或防火墙；
- 不执行节点连通性测试；
- 不暴露 token、socketName 或 correlation；
- 不自动重试。

## 预期通过结果

```text
ok=true
markerResolutionMode=phase_scoped_reverse_line_scan
endpointDataSource=reconcile_published_endpoint
endpointDataObserved=true
preflightPassed=true
productionConfigCheckPassed=true
matchingCoreCountBefore=0
orphanControlServiceCandidateCount=0
dispatchAttempted=true
dispatchCompletionMarkerObserved=true
dispatchExitCode=0
controlServiceStarted=true
controlServiceProcessAlive=true
controlServiceCommandValidated=true
controlServiceOwnerValidated=true
controlServiceRemainsRunning=true
endpointFileCanonical=true
endpointModeValidated=true
endpointOwnerValidated=true
endpointSchemaValidated=true
endpointContractReady=true
localSocketPublicConnectUsed=true
connectTimeoutOverloadUsed=false
socketReadTimeoutConfigured=true
socketConnected=true
requestSent=true
requestCount=1
responseStatus=PONG
responseStatusMatched=true
correlationMatched=true
rollbackInvoked=false
coreRunning=false
tunCreated=false
routeModified=false
readyForProductionLifecycleIntegration=true
nextAuthorizedOperation=runtime_core_lifecycle_control_integration
```

若有效控制服务在 Retry 1 启动前已存在，允许：

```text
existingControlServiceReused=true
endpointDataSource=preflight_reused_endpoint
dispatchAttempted=false
```

其余 endpoint、PING 和安全门禁不变。

## 静态验证

- 模块 JavaScript 语法检查：通过；
- 完整入口 JavaScript 语法检查：通过；
- Rhino ES5 禁用语法扫描：通过；
- 嵌入源码 SHA-256 与入口声明一致；
- Shell 内容未改变，仅修复 JavaScript marker 汇总与阶段数据选择；
- 真机验证：待执行。
