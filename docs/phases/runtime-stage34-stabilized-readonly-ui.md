# Runtime 阶段 34：只读 UI 正式模块集收口

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 隔离入口版本：`47`
- 模块集：`20260803.10`
- 模块数：`21`
- 状态：待真机验证

## 阶段目标

将阶段 30–33 已通过的只读 Runtime UI 能力收敛为干净模块集，退出临时内联入口和系统返回实验链。

## 正式模块集

基础 UI：

- `sbh_01_base.js` 至 `sbh_16_runtime_status_home.js`

只读 Runtime UI：

- `sbh_30_runtime_authenticated_status_adapter.js`
- `sbh_33_window_explicit_geometry.js`
- `sbh_34_runtime_startup_ui_finalizer.js`
- `sbh_35_runtime_sync_ui_actions.js`
- `sbh_42_inline_feedback.js`

## 新模块

### `sbh_42_inline_feedback.js`

- SHA-256：`54c5c6403941d4a8750971faf5b3cb2b1ebeed19a17bc0830bb41accb4a3fbdd`
- 仅负责将 Toast 类操作结果显示在浮窗内部。
- 保留握手、门禁和刷新反馈。
- 不注册系统返回回调。
- 不修改窗口 flags、焦点、模态属性或状态栏布局。
- 不添加边缘手势或返回把手。

## 模块集调整

退出正式 manifest：

- `sbh_36_back_inline_feedback.js`
- `sbh_37_back_dispatch_repair.js`

进入正式 manifest：

- `sbh_42_inline_feedback.js`

`module-manifest.json` 更新为：

- `moduleSetVersion = 20260803.10`
- `entryMinVersion = 47`
- `moduleCount = 21`

## 测试入口

- `entry/SingBoxHub.stage34.stabilized-readonly-ui.js`
- 固定模块提交：`71fce85a6f63d8ceb71c1c5110010fc65386401f`
- manifest 与全部模块从同一个不可变提交读取。
- 不依赖设备旧模块集回退来完成本轮验证。

## 真机门禁

1. 在线下载 21 个模块并通过 SHA-256 校验。
2. 浮窗顶部保持在状态栏安全区下方。
3. 首页、节点、日志和设置页面显示正常。
4. 底部导航切换正常。
5. 握手、门禁和刷新均显示浮窗内反馈。
6. 右上角关闭按钮正常。
7. 只发送一次认证 PING，并收到匹配的 PONG。
8. 不启动或停止 Core，不创建 TUN，不修改路由或配置。
9. 系统侧滑返回不属于本轮门禁。

## 下一步

真机验证通过后，将版本 47 的模块列表和 `20260803.10` manifest 提升到正式 `entry/SingBoxHub.js`，随后进入订阅数据链实现阶段。
