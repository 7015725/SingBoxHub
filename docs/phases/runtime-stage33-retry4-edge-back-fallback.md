# Runtime 阶段 33 重试 4：ColorOS 浮窗边缘返回兜底

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`42`
- 测试模块集：`20260803.08+back37+edge38-inline`
- 新模块：`sbh_38_edge_back_fallback.js`
- 模块 SHA-256：`ee30e4dd4d861dafbc7ee34b107caa936f4d178eec8b8b3e9e7d1099d0d37ce3`
- 状态：待真机验证

## 1. 输入证据

Stage 33 Retry 3 已确认以下门禁全部通过：

- `OnBackAnimationCallback` 代理类型校验通过；
- 回调在根 View attached 后注册；
- 使用 `PRIORITY_DEFAULT=0`；
- 根 View 已 attach、已获取窗口焦点；
- 旧 `PRIORITY_OVERLAY` 回调已注销；
- UI、Runtime 认证与浮窗内反馈正常。

实际测试仍为：

- 节点或设置页面系统侧滑无反应；
- 手动回到首页后系统侧滑仍不能关闭浮窗。

结论：ColorOS 未向当前 `TYPE_APPLICATION_OVERLAY` 窗口分发系统返回事件。继续更换 `OnBackInvokedCallback` 注册参数不能解决实际行为。

## 2. 实现内容

增加窗口内边缘返回兜底，同时保留已经注册的系统返回回调：

1. 根窗口左右各增加一个完全透明的 `28dp` 边缘触摸区域；
2. Android 10 及以上尝试设置左右系统手势排除矩形，使触摸序列可交给浮窗；
3. 左侧向右或右侧向左滑动至少 `64dp` 时触发返回；
4. 纵向偏移最大 `88dp`；
5. 手势最长持续 `1200ms`；
6. 有效触发时提供轻量震动反馈；
7. 二级页面触发后返回首页；
8. 首页触发后关闭浮窗；
9. 无效手势不会触发页面返回或关闭；
10. 普通内容区点击、纵向滚动、底部导航和右上角关闭按钮保持原行为。

## 3. 入口策略

由于通用更新器当前会在远端同步错误后回退旧 manifest，并覆盖原始错误，本次测试入口继续采用：

- 本地验签通过的 `20260803.08` 21 模块；
- 内嵌并校验 `sbh_37_back_dispatch_repair.js`；
- 内嵌并校验 `sbh_38_edge_back_fallback.js`；
- 不读取远端 manifest；
- 不访问网络；
- 不改写本地模块集。

## 4. 启动门禁

预期输出：

```json
{
  "entryVersion": 42,
  "moduleSetVersion": "20260803.08+back37+edge38-inline",
  "edgeModuleVerified": true,
  "edgeBackFallbackReady": true,
  "edgeBackGestureExclusionAttempted": true,
  "edgeBackGestureExclusionApplied": true,
  "edgeBackGestureExclusionError": null,
  "edgeBackGestureEdgeWidthDp": 28,
  "edgeBackGestureTriggerDistanceDp": 64,
  "edgeBackGestureMaxVerticalDp": 88,
  "edgeBackGestureMaxDurationMs": 1200,
  "systemBackCallbackRetained": true
}
```

## 5. 安全边界

本阶段只修改客户端 UI 手势处理：

- 不新增 Runtime Socket 请求；
- 启动阶段仍只有一次认证 `PING`；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、配置或 Runtime 文件；
- 写操作继续锁定。

## 6. 真机门禁

1. 打开节点或设置页面；
2. 从左边缘向右滑动，或从右边缘向左滑动；
3. 确认二级页面返回首页；
4. 首页再次执行边缘滑动；
5. 确认浮窗关闭；
6. 重新打开后检查握手、门禁和刷新反馈；
7. 确认右上角关闭按钮仍正常。

通过前不提升正式入口。