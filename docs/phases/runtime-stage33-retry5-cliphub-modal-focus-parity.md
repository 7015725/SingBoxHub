# Runtime 阶段 33 重试 5：对齐 ClipHub 模态窗口焦点参数

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 隔离入口版本：`45`
- 测试模块集：`20260803.08+cliphub40+focus41-inline`
- 测试模块：`src/sbh_41_cliphub_modal_focus_parity.js`
- 状态：真机失败，已撤销

## 1. Retry 4 输入

Retry 4 已确认系统返回回调注册链完整，但启动状态为：

```json
{
  "clipHubSystemBackReady": true,
  "clipHubSystemBackRootFocused": true,
  "clipHubSystemBackWindowFocused": false,
  "clipHubSystemBackCallbackMode": "OnBackAnimationCallback",
  "clipHubSystemBackPriority": 0
}
```

## 2. Retry 5 变更

测试模块尝试清除：

- `FLAG_NOT_TOUCH_MODAL`
- `FLAG_NOT_FOCUSABLE`
- `FLAG_ALT_FOCUSABLE_IM`

并保留：

- `FLAG_LAYOUT_IN_SCREEN`
- `FLAG_HARDWARE_ACCELERATED`

窗口 attach 后还通过 `updateViewLayout()` 重新应用参数并请求焦点。

## 3. 真机结果

用户在 Android 14 / ColorOS 真机验证后确认：

1. 节点页系统侧滑返回仍然无效；
2. 设置页系统侧滑返回仍然无效；
3. 首页系统侧滑仍不能关闭浮窗；
4. 浮窗顶部进入系统状态栏区域，状态栏图标覆盖 SingBoxHub 顶部内容；
5. 该布局异常此前不存在，确定由 Retry 5 的窗口参数对齐引入。

## 4. 判定

- 清除 `FLAG_NOT_TOUCH_MODAL` 没有解决系统返回分发；
- 直接更新全屏窗口 flags 改变了窗口对系统栏的布局关系；
- 本次尝试同时未达到功能目标并引入可见回归，因此不能保留。

## 5. 回退

已从分支删除：

```text
src/sbh_41_cliphub_modal_focus_parity.js
```

后续入口恢复 Retry 4 的窗口布局基线，不再加载该模块。

## 6. 后续边界

1. 不再通过修改 SingBoxHub 现有全屏窗口 flags 猜测系统返回行为；
2. 不加入自定义边缘手势；
3. 继续保留 Runtime、Core、TUN、路由和配置只读边界；
4. 下一轮必须先查明 ClipHub 真机返回成功时的实际 Window Focus 状态和窗口宿主差异，再决定是否继续。
