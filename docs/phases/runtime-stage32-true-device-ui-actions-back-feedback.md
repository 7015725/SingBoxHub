# Runtime 阶段 32：同步按钮动作通过，系统返回与反馈仍需修复

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`37`
- 模块集版本：`20260803.07`
- 状态：启动、认证、页面切换通过；系统返回与可见反馈未通过

## 1. 真机通过项

```json
{
  "runtimeAuthenticatedStatusAdapter": "ready",
  "authenticatedPingVerified": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "correlationMatched": true,
  "startupUiReady": true,
  "runtimeUiActionsMode": "synchronous_ui_event",
  "runtimeUiActionsReady": true,
  "runtimeUiActionsBackgroundCallbacksDisabled": true,
  "contentChildCount": 1,
  "navChildCount": 1,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false
}
```

截图确认首页主体、Runtime 状态卡、功能卡和底部导航完整显示。页面切换正常。

## 2. 阻断项

### 2.1 系统返回

系统侧滑返回不生效。现有窗口模块只依赖 `View.OnKeyListener` 和 `KEYCODE_BACK`。Android 13 及以上的返回手势已经转向窗口级 `OnBackInvokedCallback`，因此旧监听不能作为 Android 14 的主路径。

### 2.2 操作反馈

“握手 / 门禁 / 刷新”当前使用 Toast 提示。全屏 `TYPE_APPLICATION_OVERLAY` 浮窗位于 Toast 视觉层之上，用户无法看到反馈，因而无法确认动作结果。

## 3. 阶段判定

- Runtime 协议：通过；
- 启动页面：通过；
- 页面切换：通过；
- 系统返回：失败；
- 操作反馈可见性：失败；
- 正式入口提升：继续禁止。

下一阶段只修复返回链和浮窗内反馈，不修改 Runtime 服务、Core、TUN、路由或配置。
