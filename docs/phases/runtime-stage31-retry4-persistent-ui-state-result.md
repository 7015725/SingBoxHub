# Runtime 阶段 31 重试 4：持久 UI 状态结果

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 阶段：`runtime_stage31_retry4_persistent_ui_state_diagnostic`
- 状态：诊断完成

## 1. 执行约束修正

ShortX 新入口执行前必须结束旧任务或关闭旧窗口，因此“保持旧窗口开启后替换入口并执行新任务”不可行。

后续诊断不得依赖跨任务访问 `global.__SBH_APP__` 或活动窗口对象，必须在同一个入口中完成测量并将结果写入返回 JSON或持久状态文件。

## 2. 持久状态证据

```json
{
  "moduleSetVersion": "20260803.03",
  "firstRenderSynchronous": true,
  "firstRenderContentChildCount": 1,
  "firstRenderNavChildCount": 1,
  "runtimeAttached": true,
  "runtimeWriteGate": "readonly_authenticated"
}
```

`after_remove_view` 是用户为了替换入口而关闭窗口后的正常最终状态，不能用它判断首次渲染是否发生。

真正关键的字段是：

- `firstRenderSynchronous=true`；
- `firstRenderContentChildCount=1`；
- `firstRenderNavChildCount=1`。

这证明同步 `renderNow(0)` 已进入，首页和底部导航视图均已成功加入对应容器。

## 3. 排除项

本次证据排除：

- 首次渲染回调完全未执行；
- 首页工厂未注册；
- 底部导航构建未调用；
- `content` 或 `nav` 容器仍为空。

## 4. 当前根因范围

截图仍仅显示顶部栏，因此问题收敛为：

```text
子视图存在
    ↓
父容器或子视图实际高度为 0
或
LinearLayout weight / shell 测量结果异常
或
可见区域被错误布局到屏幕外
```

下一阶段不再使用跨任务活动窗口诊断，而是在候选入口内部使用显式 `FrameLayout` 几何，并把 root、shell、content、nav 的实际测量尺寸直接写入入口 JSON。

## 5. 安全边界

本次只读取 SingBoxHubClient 的 UI 状态文件：

```json
{
  "shellExecuted": false,
  "networkAccessed": false,
  "runtimeRequestSent": false,
  "socketConnectionAttempted": false,
  "endpointRead": false,
  "tokenRead": false,
  "filesModified": false,
  "destructiveOperations": false
}
```
