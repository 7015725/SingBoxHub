# Runtime 阶段 33：系统返回延期处理

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 状态：关闭当前阻塞，延期处理

## 真机结论

1. `OnBackInvokedCallback`、`OnBackAnimationCallback` 均可完成注册。
2. 根 View 可获得焦点，但 ColorOS 未将系统侧滑返回事件稳定分发给当前 SingBoxHub 浮窗。
3. 对齐 ClipHub 模态窗口参数未解决返回问题，并造成浮窗进入状态栏区域。
4. 自定义边缘滑动、透明触摸区和可见返回把手均不属于系统返回，已撤销且禁止进入正式模块集。

## 用户决定

当前版本不再继续处理系统侧滑返回，系统返回不再作为后续 Runtime UI 阶段的阻塞项。

## 保留交互

- 右上角关闭按钮继续作为明确关闭入口。
- 底部导航继续负责页面切换。
- 不安装自定义边缘返回手势。
- 不再修改窗口焦点、模态属性或状态栏布局以尝试接收系统返回。

## 正式模块集处理

以下系统返回实验模块不进入下一正式模块集：

- `sbh_36_back_inline_feedback.js`
- `sbh_37_back_dispatch_repair.js`
- `sbh_40_cliphub_system_back_port.js`
- `sbh_41_cliphub_modal_focus_parity.js`

其中可见操作反馈拆分为独立的 `sbh_42_inline_feedback.js`。

## 安全边界

本决定不改变 Runtime、Core、TUN、路由、配置及写操作门禁。
