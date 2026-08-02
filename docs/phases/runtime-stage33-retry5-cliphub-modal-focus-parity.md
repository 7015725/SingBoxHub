# Runtime 阶段 33 重试 5：对齐 ClipHub 模态窗口焦点参数

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 隔离入口版本：`45`
- 测试模块集：`20260803.08+cliphub40+focus41-inline`
- 新模块：`src/sbh_41_cliphub_modal_focus_parity.js`
- 状态：待真机验证

## 1. Retry 4 真机结果

参考 ClipHub 导航注册链的 Retry 4 已确认：

```json
{
  "clipHubSystemBackReady": true,
  "clipHubSystemBackEntryCount": 1,
  "clipHubSystemBackCandidateCount": 1,
  "clipHubSystemBackRegisterCount": 1,
  "clipHubSystemBackCallbackMode": "OnBackAnimationCallback",
  "clipHubSystemBackPriority": 0,
  "clipHubSystemBackRootTitle": "SingBoxHub Full UI",
  "clipHubSystemBackRootSameAsController": true,
  "clipHubSystemBackRootFocused": true,
  "clipHubSystemBackWindowFocused": false,
  "clipHubSystemBackAnimationProxyValidated": true,
  "clipHubSystemBackLastError": null
}
```

用户确认节点页和设置页系统返回均未触发。

## 2. 根因收敛

回调类型、注册优先级、实际根 View 扫描、代理类型、attach 状态和 View Focus 均已通过；唯一失败门禁是：

```text
hasWindowFocus = false
```

`View.isFocused()` 只能说明 View 内部焦点状态，系统返回分发依赖 Window Focus。

## 3. 与 ClipHub 的实际参数差异

ClipHub 当前主窗口由 `src/ch_11_filter.js` 创建，flags 为：

```javascript
FLAG_LAYOUT_IN_SCREEN |
FLAG_HARDWARE_ACCELERATED |
FLAG_DIM_BEHIND
```

其中没有：

```javascript
FLAG_NOT_TOUCH_MODAL
FLAG_NOT_FOCUSABLE
FLAG_ALT_FOCUSABLE_IM
```

SingBoxHub 基础窗口仍包含 `FLAG_NOT_TOUCH_MODAL`。此前返回模块只处理 `FLAG_NOT_FOCUSABLE`，没有完成主窗口参数对齐。

## 4. Retry 5 修改

新增模块只调整窗口参数和焦点：

1. 在 `addView()` 前清除：
   - `FLAG_NOT_TOUCH_MODAL`
   - `FLAG_NOT_FOCUSABLE`
   - `FLAG_ALT_FOCUSABLE_IM`
2. 增加：
   - `FLAG_LAYOUT_IN_SCREEN`
   - `FLAG_HARDWARE_ACCELERATED`
3. 窗口 attach 后再次读取实际 `LayoutParams` 并通过 `updateViewLayout()` 对齐；
4. 在主线程设置根 View focusable 并请求焦点；
5. 延迟 180ms 复核根 View Focus 和 Window Focus；
6. 保留 Retry 4 的 ClipHub 原生系统返回注册链；
7. 不加入透明触摸区、边缘把手或自定义滑动手势；
8. 不增加 Runtime 请求，不启动 Core/TUN，不修改路由和配置。

## 5. 真机门禁

启动结果应包含：

```json
{
  "entryVersion": 45,
  "moduleSetVersion": "20260803.08+cliphub40+focus41-inline",
  "focusModuleVerified": true,
  "customEdgeGestureInstalled": false,
  "modalFocusParityApplied": true,
  "modalFocusParityAfter": {
    "notFocusable": false,
    "notTouchModal": false,
    "altFocusableIm": false,
    "layoutInScreen": true,
    "hardwareAccelerated": true
  },
  "modalFocusParityAttached": true,
  "modalFocusParityRootFocused": true,
  "modalFocusParityWindowFocused": true,
  "modalFocusParityError": null
}
```

随后验证：节点页返回首页、设置页返回首页、首页关闭浮窗。

## 6. 边界

本模块仅用于隔离真机验证，暂不加入正式 manifest。只有 Window Focus 与真实系统返回同时通过后，才进入正式模块集。
