# Runtime 阶段 33 重试 5：受限可见边缘返回把手

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`43`
- 测试模块集：`20260803.08+back37+edge38+bounded39-inline`
- 状态：待真机验证

## 1. 输入证据

Stage 33 Retry 4 启动成功，且返回：

```json
{
  "edgeBackFallbackReady": true,
  "edgeBackGestureExclusionAttempted": true,
  "edgeBackGestureExclusionApplied": true,
  "edgeBackGestureExclusionError": null
}
```

但用户确认二级页面和首页的边缘返回仍然异常。

上述字段只代表 `setSystemGestureExclusionRects()` 调用被接受，不能证明整条屏幕边缘都已交给浮窗。Android 对普通左右系统手势排除区域施加最多 200dp 的纵向范围限制。上一版提交全屏高度矩形，因此实际有效区域不明确，常规位置的边缘滑动仍可能被 ColorOS 优先消费。

## 2. 实现

新增：

- `src/sbh_39_bounded_edge_back_handles.js`
- SHA-256：`961c77e31693dfbf9344134aaf37eb04cb52cdbe3596ed10baff1ac27f831707`

处理方式：

1. 移除上一版全屏高度透明边缘 View；
2. 左右各建立 `72dp × 200dp`、垂直居中的触摸区；
3. 排除矩形精确限制为同一 `72dp × 200dp` 区域；
4. 触摸区内增加可见的细侧边把手；
5. `ACTION_DOWN` 后显示浮窗内提示，并提高把手透明度；
6. 横向滑动达到 `56dp` 后触发返回；
7. 二级页面返回首页，首页关闭浮窗；
8. 触发成功提供轻微震动；
9. 保留 `OnBackAnimationCallback` 和旧 Key 监听。

## 3. 手势参数

```text
触摸区宽度：72dp
有效纵向高度：200dp
可见把手：5dp × 72dp
把手距屏幕边缘：14dp
最小横向位移：56dp
最大纵向偏移：72dp
最长持续时间：1500ms
```

## 4. 安全边界

本阶段仅修改 UI 输入分发：

- 不增加 Runtime 请求；
- 不读取或暴露 token；
- 不启动或停止控制服务及 Core；
- 不创建 TUN；
- 不修改路由、配置或 Runtime 文件；
- 保留只读认证和写操作锁定。

## 5. 真机门禁

启动结果应包含：

```json
{
  "entryVersion": 43,
  "boundedModuleVerified": true,
  "boundedEdgeBackReady": true,
  "boundedEdgeExclusionApplied": true,
  "boundedEdgeExclusionError": null,
  "boundedEdgeVisibleHandles": true
}
```

操作验证：

1. 屏幕中部左右边缘应显示细侧边把手；
2. 从把手或把手内侧开始滑动时，应显示“继续滑动返回”；
3. 二级页面滑动应返回首页；
4. 首页再次滑动应关闭浮窗；
5. 普通页面点击、纵向滚动、底部导航和 Runtime 操作反馈保持正常。

系统回调实际仍不分发时，此把手属于明确可见的窗口内返回兜底，不再将其误判为原生系统返回已修复。
