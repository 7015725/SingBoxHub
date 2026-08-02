# Runtime 阶段 31：认证只读适配器 UI 集成候选

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage31.js`
- 下载文件：`SingBoxHub_Runtime只读适配器UI集成阶段31.txt`
- 下载文件 SHA-256：`b3ce387cef8458d35499b661274aff7d4d8382cde5a4a677b7c25515bd1f5d6a`
- 模块：`src/sbh_30_runtime_authenticated_status_adapter.js`
- 模块 SHA-256：`a5af192fb90f413ac9bfb327d366ee749d1787d34597a4cc4a7c0e9c94bd982e`
- 模块集版本：`20260803.01`
- 入口最低版本：`31`
- 状态：实现完成，真机验证待执行

## 1. 阶段目标

将 Stage 30 已验证的认证 `PING` 契约接入常驻 UI 的 `SBH.runtime`，替换原先仅依赖 Shell 文件存在性的握手显示。

主入口暂不升级。本阶段通过隔离入口验证完整 UI、模块下载、Runtime Client 和首页状态联动。

## 2. 清理后的常驻模块集

Stage 31 候选模块集只包含：

```text
sbh_01_base.js
...
sbh_16_runtime_status_home.js
sbh_30_runtime_authenticated_status_adapter.js
```

共 17 个模块。

阶段 17–29 的协议分析、一次性探针和控制服务启动模块继续保留在仓库中作为历史实现与诊断工具，但不再进入常驻 UI 加载链。

这样可避免：

- UI 启动时再次执行旧的一次性授权逻辑；
- 控制服务启动探针被误当成常驻能力；
- 静态分析模块长期增加启动耗时；
- 旧阶段缓存影响正式 Runtime 状态。

## 3. Runtime Client 行为

适配器覆盖：

```text
SBH.runtime.status()
SBH.runtime.refresh()
SBH.runtime.refreshAsync()
SBH.runtime.request()
SBH.runtime.requestAsync()
SBH.runtime.handshake()
```

开放命令：

```text
runtime.handshake
runtime.status
core.status
```

`runtime.write_gate` 只返回“写操作保持锁定”的只读状态，不执行任何写命令。其他命令返回 `READ_ONLY_CLIENT`。

## 4. 连接策略

- UI 启动时执行一次认证状态刷新；
- 点击“握手”时执行一次认证 `PING`；
- 点击“刷新”时执行一次认证 `PING`；
- 不轮询；
- 不自动重试；
- 同一时间只允许一个异步刷新；
- 每次连接只发送一笔三行事务并关闭 Socket。

## 5. 安全边界

```json
{
  "readOnly": true,
  "writeOperationsLocked": true,
  "pollingEnabled": false,
  "automaticRetryAllowed": false,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false
}
```

## 6. 入口隔离

`entry/SingBoxHubStage31.js`：

1. 从固定提交 `333bf86c051f746e1843bdf7ef9d4f2967a7fa52` 读取已验证基础入口；
2. 将入口版本改为 `31`；
3. 将模块声明替换为干净的 17 模块顺序；
4. 从当前测试分支下载并校验 `module-manifest.json`；
5. 主入口 `entry/SingBoxHub.js` 保持不变。

如果 Stage 31 失败，正式入口仍会使用本地 last-good 模块集，不受候选 manifest 影响。

## 7. 真机通过条件

入口返回结果至少满足：

```text
ok=true
entryVersion=31
moduleSetVersion=20260803.01
app.runtimeAuthenticatedStatusAdapter=ready
app.runtimeAttached=true
app.authenticatedPingVerified=true
app.runtimeTransport=android_local_socket_authenticated_ping
app.runtimeAuthenticatedStatusAdapterDetails.requestCount=1
app.runtimeAuthenticatedStatusAdapterDetails.responseStatus=PONG
app.runtimeAuthenticatedStatusAdapterDetails.correlationMatched=true
app.runtimeFilesModified=false
app.coreStartInvoked=false
app.tunCreated=false
app.routeModified=false
app.configModified=false
```

同时检查 UI：

- 首页显示 Runtime 已只读接入；
- Core 当前显示停止；
- 握手与刷新按钮可正常完成；
- 系统返回、IME、其他页面和窗口行为不回归。

## 8. 后续门禁

Stage 31 真机通过后：

1. 将正式入口升级至版本 31；
2. 正式入口声明 17 模块候选集；
3. 保留阶段 17–29 文件但从 manifest 中移除；
4. 再进入 Core 启停命令设计，必须单独授权，不在本阶段开放。
