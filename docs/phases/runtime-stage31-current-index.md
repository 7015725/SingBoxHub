# Runtime 阶段 31 当前索引

- `runtime-stage31-authenticated-adapter-ui-integration.md`
  - 认证只读适配器首次 UI 集成方案
- `runtime-stage31-true-device-auth-success-ui-blank.md`
  - 认证通过但页面主体与底部导航空白
- `runtime-stage31-retry1-bounded-ui-render-recovery.md`
  - 有限延迟重绘未解决空白问题
- `runtime-stage31-retry2-active-window-diagnostic-limit.md`
  - 记录 ShortX 独立任务无法共享 Rhino 活动窗口对象
- `runtime-stage31-retry3-synchronous-first-render.md`
  - 同步首次渲染后仍为空白
- `runtime-stage31-retry4-persistent-ui-state-result.md`
  - 持久状态证明 content 与 nav 子视图均已创建
- `runtime-stage31-retry5-explicit-window-geometry.md`
  - 使用显式 FrameLayout 几何替代 LinearLayout weight，并返回测量尺寸

当前候选版本：

```text
entryVersion=35
moduleSetVersion=20260803.05
```

正式入口仍未提升。只有 Retry 5 的 JSON 几何门禁和实际截图同时通过后，才允许更新正式入口。
