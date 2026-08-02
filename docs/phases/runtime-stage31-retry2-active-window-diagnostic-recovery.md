# Runtime 阶段 31 重试 2：活动窗口诊断与 UI-only 修复

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 下载文件：`SingBoxHub_Runtime活动窗口诊断与修复重试2.txt`
- SHA-256：`537333b5d08016bb5032c55de0bb00bf8ec9f57941284e3967346abeb5671262`
- 阶段：`runtime_stage31_retry2_active_window_diagnostic_recovery`
- 状态：实现完成，真机验证待执行

## 1. 目标

不重新加载 UI 模块、不重复认证 PING，直接检查当前仍在显示的活动窗口控制器。

诊断对象：

```text
global.__SBH_APP__.controller
controller.root
controller.shell
controller.content
controller.nav
controller.runtimeBadge
```

## 2. 诊断内容

脚本分别记录修复前后的：

- 控制器 `attached/visible/rendering/closing/stage/page`；
- View 的可见性；
- 实际宽高和 measured 宽高；
- LayoutParams 类型、宽度、高度和 weight；
- `content` 与 `nav` 子视图数量。

## 3. 同次 UI-only 修复

在主线程中执行：

1. 如果 `rendering` 长时间残留为 true，则清除该卡死标志；
2. 恢复 shell 为垂直 `LinearLayout` 和全屏 FrameLayout 参数；
3. 恢复 content 为 `MATCH_PARENT × 0, weight=1`；
4. 恢复 nav 为 `MATCH_PARENT × 68dp`；
5. 将 root/content/nav 设为可见；
6. 直接调用 `controller.renderNow(0)`；
7. 调用 `requestLayout()` 与 `invalidate()`；
8. 返回修复后的子视图数量和尺寸。

成功条件：

```text
ok=true
uiRecovered=true
after.content.childCount>0
after.nav.childCount>0
```

## 4. 安全边界

```json
{
  "runtimeRequestSent": false,
  "socketConnectionAttempted": false,
  "endpointRead": false,
  "tokenRead": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "runtimeFilesModified": false,
  "destructiveOperations": false
}
```

该脚本只操作当前窗口的 View 层级和 LayoutParams，不修改 Runtime、配置或持久化文件。

## 5. 执行要求

必须在 Stage 31 Retry 1 的空白窗口仍保持打开时执行。不要先点击关闭按钮，否则会返回 `ACTIVE_UI_CONTROLLER_UNAVAILABLE`。
