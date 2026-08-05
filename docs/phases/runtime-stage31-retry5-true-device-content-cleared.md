# Runtime 阶段 31 重试 5：几何正常但主体被异步清空

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`35`
- 模块集版本：`20260803.05`
- 状态：认证与显式几何通过；页面主体仍为空白

## 1. 真机结果

```json
{
  "runtimeAttached": true,
  "runtimeAuthenticatedStatusAdapter": "ready",
  "authenticatedPingVerified": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "correlationMatched": true,
  "explicitGeometryApplied": true,
  "firstRenderSynchronous": true,
  "contentMeasuredHeight": 2210,
  "navMeasuredHeight": 209,
  "contentChildCount": 0,
  "navChildCount": 1,
  "uiGeometryReady": false
}
```

## 2. 关键排除项

以下部分已经排除：

- 根窗口宽高为 `1264 × 2640`，正常；
- 显式 FrameLayout shell 宽高正常；
- content 实际高度为 `2210px`，不为零；
- nav 实际高度为 `209px`，不为零；
- nav 子视图数量为 1，底部导航构建成功；
- 认证 Runtime 状态正常且仅发送一次 PING。

因此空白不再属于 LinearLayout weight、窗口尺寸、content 高度或 nav 高度问题。

## 3. 根因定位

上一轮持久状态曾确认：

```text
firstRenderContentChildCount = 1
firstRenderNavChildCount = 1
```

而本轮入口返回前变为：

```text
contentChildCount = 0
navChildCount = 1
```

`src/sbh_15_app.js` 在窗口打开后执行：

```text
SBH.runtime.refreshAsync(applyRuntimeResult)
```

`applyRuntimeResult()` 又在首页时调用：

```text
controller.showPage(0)
```

认证适配器会暂存该启动回调，并在同步认证 PING 完成后释放。此时页面已经首次构建成功；释放后的异步页面重建在 ShortX 任务收尾边界开始执行，先清空 `controller.content`，但未可靠完成后续页面构建，最终形成 `content=0、nav=1`。

配套录像显示：窗口出现并完成顶部状态更新后，主体持续为空白，与该清空时序一致。

## 4. 阶段结论

- Runtime 认证链路：通过；
- 显式几何布局：通过；
- 首次同步渲染：通过；
- 启动后的异步页面重建：失败；
- 正式入口提升：继续禁止。

下一步不再修改窗口尺寸，而是在启动阶段抑制旧自动 `refreshAsync` 回调，并在认证完成后执行一次最终同步渲染。
