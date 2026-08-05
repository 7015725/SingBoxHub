# Runtime 阶段 32：同步 UI 动作与导航回归验证

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage32.js`
- 下载文件：`SingBoxHub_Runtime按钮同步动作验证阶段32.txt`
- 下载文件 SHA-256：`2ddcfd7267dd5e9fa7c6e5e909e1d35acc6f3a0bea9854549a4d59517661c555`
- 新模块：`src/sbh_35_runtime_sync_ui_actions.js`
- 新模块 SHA-256：`1f82024ebeb6bb16fb5736ade02cae98fae5f55df73a5f347d347ebccd3d5b41`
- 模块集版本：`20260803.07`
- 入口最低版本：`37`
- 模块数量：`20`
- 状态：实现完成，真机验证待执行

## 目标

验证 Stage 31 已恢复的完整 UI 在实际操作后不会再次因为后台 Rhino 回调被清空或卡住。

本阶段覆盖：

- 首页“握手”按钮；
- 首页“门禁”按钮；
- 首页“刷新”按钮；
- 首页、节点、日志、设置之间的页面切换；
- 二级页面返回首页；
- 首页返回或关闭按钮关闭窗口。

## 实现

新增同步 UI 动作适配模块：

```text
sbh_35_runtime_sync_ui_actions.js
```

它保留既有 `requestAsync/refreshAsync` 调用形态，但内部在当前点击事件中直接调用：

```text
SBH.runtime.request()
SBH.runtime.refresh()
```

回调在同一个 UI 事件内立即完成，不再创建后台 Rhino 回调，也不使用轮询或自动重试。

启动阶段仍由 Stage 31 Retry 6 模块拦截旧自动刷新，因此启动认证请求数保持为 1。

## 入口输出门禁

```text
entryVersion=37
moduleSetVersion=20260803.07
app.runtimeAuthenticatedStatusAdapter=ready
app.startupUiReady=true
app.runtimeUiActionsMode=synchronous_ui_event
app.runtimeUiActionsReady=true
app.runtimeUiActionsBackgroundCallbacksDisabled=true
app.runtimeUiActionsPollingEnabled=false
app.runtimeUiActionsAutomaticRetry=false
```

启动阶段仍应满足：

```text
app.runtimeAuthenticatedStatusAdapterDetails.requestCount=1
app.runtimeAuthenticatedStatusAdapterDetails.responseStatus=PONG
app.runtimeAuthenticatedStatusAdapterDetails.correlationMatched=true
app.contentChildCount=1
app.navChildCount=1
app.runtimeFilesModified=false
```

## 手工操作门禁

按顺序操作：

1. 点击“握手”：应提示认证只读握手成功，页面保持完整；
2. 点击“门禁”：应提示所有写操作继续锁定，页面保持完整；
3. 点击“刷新”：应提示 Runtime 状态已刷新，页面保持完整；
4. 依次打开节点、日志、设置，再返回首页；
5. 在二级页面使用系统返回，应回到首页；
6. 在首页使用系统返回或右上角关闭按钮，应正常关闭窗口。

任一动作导致主体空白、导航消失、窗口卡死或写操作执行，都判定失败。

## 安全边界

```json
{
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

通过后可将候选模块集和入口提升为正式 Runtime 只读 UI 入口。
