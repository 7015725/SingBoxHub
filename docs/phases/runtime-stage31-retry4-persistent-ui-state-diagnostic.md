# Runtime 阶段 31 重试 4：持久化 UI 状态只读诊断

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 下载文件：`SingBoxHub_UI持久状态诊断阶段31重试4.txt`
- SHA-256：`df9bce08573b090d76c0ffd9b8488a891ae61946f0eaf641ea215d4f24721563`
- 状态：实现完成，真机验证待执行

## 1. 目标

Retry 3 的入口结果未暴露控制器子视图计数，无法区分渲染未进入、页面构建失败和布局不可见。

本诊断不再创建窗口，也不尝试从另一个 Rhino 任务读取内存控制器。它只读取 SingBoxHubClient 已经持久化的安全状态文件：

```text
bootstrap/full_ui_window_state.json
cache/ui_status.json
bootstrap/active.json
bootstrap/last_good.json
bootstrap/update_state.json
```

明确排除：

```text
cache/control_endpoint.json
Runtime endpoint
Runtime token
socketName
订阅或配置文件
```

## 2. 诊断判定

输出将归类为以下之一：

```text
PAGE_FACTORY_OR_NAVIGATION_BUILD_ERROR
FIRST_RENDER_NOT_ENTERED_OR_CHECKPOINT_STALE
CHILDREN_PRESENT_LAYOUT_OR_OVERLAY_VISIBILITY
RENDER_COMPLETED_WITH_MISSING_CHILDREN
RENDER_STAGE_KNOWN_CHILD_COUNTS_UNAVAILABLE
```

重点字段：

```text
interpretation.checkpointStage
interpretation.pageRenderAttempted
interpretation.pageRenderCompleted
interpretation.pageRenderFailed
interpretation.synchronousRenderModuleObserved
interpretation.contentChildCount
interpretation.navChildCount
interpretation.likelyCategory
```

## 3. 安全边界

```json
{
  "readOnly": true,
  "shellExecuted": false,
  "networkAccessed": false,
  "uiCreated": false,
  "runtimeRequestSent": false,
  "socketConnectionAttempted": false,
  "endpointRead": false,
  "tokenRead": false,
  "filesModified": false,
  "destructiveOperations": false
}
```

脚本最终使用 `JSON.stringify()` 返回，避免再次显示 `[object Object]`。

## 4. 下一步门禁

只有拿到持久状态后才选择修复方向：

- `page_render_failed`：修复具体页面工厂或导航异常；
- `after_page_render` 且子视图均存在：定位布局尺寸、可见性或窗口叠加；
- 未进入渲染：定位模块覆盖或控制器调用链；
- 状态文件陈旧：在同一入口中直接返回控制器状态，不再依赖异步写盘。
