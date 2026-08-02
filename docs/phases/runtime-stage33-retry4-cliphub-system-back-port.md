# Runtime 阶段 33 重试 4：参考 ClipHub 的原生系统返回链

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 隔离入口版本：`44`
- 测试模块集：`20260803.08+cliphub40-inline`
- 测试模块：`sbh_40_cliphub_system_back_port.js`
- 测试模块 SHA-256：`051a85b0062a17dd1c38617d4ddf67ddb34329830879f4bc42d68c64214da53d`
- 状态：待真机验证；未进入正式 manifest

## 1. 前序方案撤销

Stage 33 原 Retry 4、Retry 5 使用透明边缘触摸区或可见把手识别横向滑动，本质上属于应用内自定义手势，不是 Android / ColorOS 系统侧滑返回，已删除且禁止继续沿用。

本阶段仅处理系统返回事件接收与页面返回链，不增加任何边缘手势区域、返回把手或横向触摸识别。

## 2. 参考源码

当前 GitHub 安装中不存在 `7015725/Chiphub`，可访问且包含已验证系统返回实现的是：

```text
7015725/ClipHub
src/ch_12_translation.js
```

关键历史提交：

- `1161eabebd9d177d3e6dadb1180215fc1ea98eaa`
  - `feat: 接入系统返回与后台隐藏控制`
- `816d57f35d21101052b6b0f39c5b007066395e46`
  - `fix: 修正系统返回去重与窗口清理`

## 3. SingBoxHub 旧实现的问题

`sbh_37_back_dispatch_repair.js` 已做到：

- `OnBackAnimationCallback`；
- `PRIORITY_DEFAULT=0`；
- 根 View attached；
- 根 View 和窗口焦点为 true；
- 回调对象类型校验通过。

但它仍存在以下结构差异：

1. 只对 `controller.root` 注册一次；
2. 将“注册调用成功”等同于“系统会实际分发事件”；
3. 不扫描 `WindowManagerGlobal` 中的真实窗口根视图；
4. 不在 `0ms / 70ms / 220ms` 进行多阶段注册复核；
5. 不维护按 View 身份绑定的 callback / dispatcher 强引用条目；
6. 不监听 View attach / detach 以注销和重新扫描；
7. 不监听窗口焦点变化并触发重新扫描；
8. dispatcher 暂不可用时没有与 ClipHub 相同的最多三次延迟重试链。

因此旧 JSON 只能证明 API 注册调用没有抛错，不能证明注册对象就是 ColorOS 最终使用的实际窗口根，也不能证明回调在窗口生命周期稳定后仍处于有效状态。

## 4. 本阶段移植范围

新隔离模块按 ClipHub 的系统返回链实现：

1. 通过 `WindowManagerGlobal.getInstance().getWindowViews()` 扫描实际窗口根；
2. 仅接受标题包含 `SingBoxHub` 或与 `controller.root` 身份相同的 View；
3. 以 `System.identityHashCode(view)` 建立注册条目；
4. 保存 View、dispatcher、callback、focus listener、attach listener 和 retryCount 的强引用；
5. 首页窗口若含 `FLAG_NOT_FOCUSABLE`，清除该 flag，并保留 `FLAG_NOT_TOUCH_MODAL`；
6. 注册 `OnWindowFocusChangeListener`；
7. 注册 `OnAttachStateChangeListener`，detach 时注销回调并重新扫描；
8. Android 14 优先 `OnBackAnimationCallback`，并通过 `Class.isInstance()` 校验；
9. Android 13 回退 `OnBackInvokedCallback`；
10. 使用 `PRIORITY_DEFAULT=0`；
11. 保留 `KEYCODE_BACK / KEYCODE_ESCAPE` 兼容监听；
12. dispatcher 暂不可用时最多重试三次，延迟为 `160ms + retryCount × 140ms`；
13. 窗口打开后在 `0ms / 70ms / 220ms` 扫描；
14. 系统返回事件使用 `180ms` 同签名去重；
15. 二级页面返回首页，首页关闭浮窗。

## 5. 测试入口边界

为避开前序 manifest 回退链问题，入口继续采用已经真机通过的本地模块集：

```text
20260803.08
21 个基础模块
```

随后仅在内存中加载 `sbh_40_cliphub_system_back_port.js`：

- 不读取远端 manifest；
- 不下载模块；
- 不修改本地模块集；
- 不加入正式 module-manifest；
- 不使用 `sbh_37_back_dispatch_repair.js`；
- 不包含已撤销的 `sbh_38`、`sbh_39`；
- 不增加 Runtime 请求。

## 6. 启动门禁

预期启动 JSON：

```json
{
  "entryVersion": 44,
  "moduleSetVersion": "20260803.08+cliphub40-inline",
  "clipHubSystemBackOnly": true,
  "customEdgeGestureInstalled": false,
  "clipHubSystemBackReady": true,
  "clipHubSystemBackEntryCount": 1,
  "clipHubSystemBackCandidateCount": 1,
  "clipHubSystemBackRegisterCount": 1,
  "clipHubSystemBackCallbackMode": "OnBackAnimationCallback",
  "clipHubSystemBackPriority": 0,
  "clipHubSystemBackRootTitle": "SingBoxHub Full UI",
  "clipHubSystemBackRootSameAsController": true,
  "clipHubSystemBackRootFocused": true,
  "clipHubSystemBackWindowFocused": true,
  "clipHubSystemBackPreviousOverlayUnregistered": true,
  "clipHubSystemBackAnimationProxyValidated": true,
  "clipHubSystemBackLastError": null
}
```

## 7. 真机行为门禁

1. 打开“节点”或“设置”；
2. 使用 ColorOS 系统侧滑返回；
3. 预期窗口随系统预测性返回出现轻微位移/缩放，并回到首页；
4. 首页再次系统侧滑返回；
5. 预期浮窗关闭；
6. `握手 / 门禁 / 刷新` 浮窗内反馈保持正常；
7. 右上角关闭按钮保持正常。

如果仍不触发，下一步只读取 WindowManager / CoreBackPreview 系统日志，比较 ClipHub 与 SingBoxHub 窗口的 back callback 注册记录，不再新增其他交互方式。

## 8. 安全边界

- `runtimeFilesModified=false`
- `coreStartInvoked=false`
- `coreStopInvoked=false`
- `tunCreated=false`
- `routeModified=false`
- `configModified=false`
- `destructiveOperations=false`
