# Runtime 阶段 33：浮窗内反馈通过，系统返回仍未触发

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`38`
- 模块集版本：`20260803.08`
- 状态：操作反馈通过；系统返回门禁未通过

## 1. 真机通过项

```json
{
  "runtimeAuthenticatedStatusAdapter": "ready",
  "authenticatedPingVerified": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "correlationMatched": true,
  "startupUiReady": true,
  "runtimeUiActionsReady": true,
  "inlineFeedbackReady": true,
  "toastRoutedToInlineFeedback": true
}
```

用户确认“握手、门禁、刷新”均能在浮窗内部看到结果，Toast 被全屏浮窗遮挡的问题已经解决。

## 2. 系统返回结果

启动输出显示：

```json
{
  "systemBackRegistrationAttempted": true,
  "systemBackDispatcherAvailable": true,
  "systemBackCallbackRegistered": true,
  "systemBackRegistrationMode": "on_back_invoked_overlay",
  "systemBackPriority": 1000000,
  "systemBackRegistrationError": null
}
```

但真机系统侧滑返回仍无效。这说明：

- `View.findOnBackInvokedDispatcher()` 可用；
- 注册调用未抛异常；
- 仅凭 `registerOnBackInvokedCallback()` 返回成功不能证明 ColorOS 已把手势事件交给该回调；
- 当前 `PRIORITY_OVERLAY + OnBackInvokedCallback` 路径未通过真机事件门禁。

## 3. 已排除项

- UI 页面和底部导航正常；
- 页面切换正常；
- 窗口可交互；
- 返回异常与 Runtime Socket、PING、Core、TUN、路由和配置无关；
- 不应再次修改已通过的 Runtime 认证协议或启动渲染链。

## 4. 下一步

采用已在 ToolHub Android 14 返回链中使用的模式：

1. View attach 后通过 `post()` 注册；
2. Android 14 优先创建并校验真正的 `OnBackAnimationCallback`；
3. 使用 `PRIORITY_DEFAULT`；
4. 创建失败时回退到 `OnBackInvokedCallback`；
5. 保留旧 `KEYCODE_BACK` 监听作为兼容回退；
6. 输出窗口焦点、回调模式以及 started/progressed/cancelled/invoked 计数。

正式入口继续保持不变。
