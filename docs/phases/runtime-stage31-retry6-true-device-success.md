# Runtime 阶段 31 重试 6：UI 启动渲染真机通过

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`36`
- 模块集版本：`20260803.06`
- 状态：真机通过

## 真机结果

认证 Runtime 链路继续通过：

```json
{
  "runtimeAuthenticatedStatusAdapter": "ready",
  "authenticatedPingVerified": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "correlationMatched": true,
  "runtimeState": "stopped",
  "runtimeWriteGate": "readonly_authenticated"
}
```

UI 启动门禁通过：

```json
{
  "explicitGeometryApplied": true,
  "firstRenderSynchronous": true,
  "contentChildCount": 1,
  "navChildCount": 1,
  "contentMeasuredHeight": 2210,
  "navMeasuredHeight": 209,
  "uiGeometryReady": true,
  "startupInitialRefreshSuppressed": true,
  "suppressedInitialRefreshCount": 1,
  "startupUiFinalizationError": null,
  "startupUiReady": true
}
```

截图确认以下内容均正常显示：

- 顶部品牌栏与“只读已接入”徽标；
- Runtime 状态卡；
- “握手 / 门禁 / 刷新”按钮；
- 首页功能卡；
- 底部导航栏。

## 根因结论

旧 `app.start()` 在窗口首次同步渲染后仍发起一次 `refreshAsync()`。认证适配器完成后释放该回调，回调中的 `showPage(0)` 会先清空主体容器；在 ShortX 执行收尾阶段，后续 Rhino 页面构建不能保证完成，因此留下顶部栏和空主体。

修复方式：

1. 启动期间临时拦截旧自动 `refreshAsync()`；
2. 认证适配器执行唯一一次认证 PING；
3. 认证完成后同步应用状态；
4. 在主线程执行最终 `renderNow(0)`；
5. 同步测量并验证 `content/nav` 子视图和高度。

## 安全边界

```json
{
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

## 阶段结论

Stage 31 的启动 UI 集成门禁完成。正式入口仍不提升，下一阶段统一验证首页 Runtime 操作按钮、页面切换、返回和关闭链。
