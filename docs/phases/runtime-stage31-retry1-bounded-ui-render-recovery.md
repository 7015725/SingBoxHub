# Runtime 阶段 31 重试 1：有限 UI 页面重绘恢复

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage31Retry1.js`
- 下载文件：`SingBoxHub_Runtime只读适配器UI渲染修复重试1.txt`
- 下载文件 SHA-256：`aed135cd57680b94c1b2446958fa42036cb079ad28588f6c9dfd351c814e692f`
- 新模块：`src/sbh_31_runtime_ui_render_recovery.js`
- 新模块 SHA-256：`aa12aa8577d868653f5416b398df7edbdc0acae378447900bdf0a2c92b90a52e`
- 模块集版本：`20260803.02`
- 入口最低版本：`32`
- 模块数量：`18`
- 状态：实现完成，真机验证待执行

## 1. 修复范围

本次不重复修改已通过的认证 Runtime 适配器，不重新启动控制服务，也不增加第二次启动 PING。

只在认证适配器之后加载一个 UI 恢复模块：

```text
sbh_31_runtime_ui_render_recovery.js
```

## 2. 修复策略

旧适配器完成并返回后：

1. 获取 `SBH.global.__SBH_APP__.controller`；
2. 读取已缓存的认证 Runtime 状态；
3. 将状态徽标重新应用到控制器；
4. 通过 UI 队列无条件请求一次 `showPage(0)`；
5. 在 `220ms` 后再执行一次有限重绘兜底；
6. 第二次重绘后停止，不轮询、不自动循环重试。

该策略覆盖以下时序：

- 窗口已经 attached：立即重绘首页；
- 窗口打开任务仍在 UI 队列：重绘任务排在打开任务之后执行；
- 第一次重绘与窗口内部延迟渲染竞争：`220ms` 有限兜底再次构建页面。

## 3. 输出字段

入口返回结果新增：

```json
{
  "runtimeUiRenderRecovery": "scheduled",
  "runtimeUiRenderRecoveryVersion": 1,
  "uiRenderRecoveryScheduled": true,
  "uiRenderRecoveryDelayMs": 220,
  "uiRenderRecoveryPollingEnabled": false,
  "uiRenderRecoveryAutomaticRetry": false,
  "runtimeWriteGate": "readonly_authenticated"
}
```

## 4. 安全边界

```json
{
  "requestCount": 1,
  "pollingEnabled": false,
  "automaticRetryAllowed": false,
  "writeOperationsLocked": true,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false
}
```

UI 重绘模块不读取 endpoint、token 或 socketName，不建立新的 LocalSocket。认证请求仍由 Stage 31 适配器执行且仅执行一次。

## 5. 真机通过条件

JSON 至少满足：

```text
ok=true
entryVersion=32
moduleSetVersion=20260803.02
app.runtimeAuthenticatedStatusAdapter=ready
app.authenticatedPingVerified=true
app.runtimeAuthenticatedStatusAdapterDetails.requestCount=1
app.runtimeAuthenticatedStatusAdapterDetails.responseStatus=PONG
app.runtimeUiRenderRecovery=scheduled
app.uiRenderRecoveryScheduled=true
app.runtimeWriteGate=readonly_authenticated
app.runtimeFilesModified=false
```

UI 必须满足：

- 首页 Runtime 状态卡正常显示；
- 首页功能卡和统计区域正常显示；
- 底部导航正常显示；
- “握手”“门禁”“刷新”按钮可见；
- 页面切换、返回和关闭无回归。

通过后才允许提升正式入口。
