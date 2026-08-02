# Runtime 阶段 33：系统返回与浮窗内操作反馈

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage33.js`
- 下载文件：`SingBoxHub_系统返回与浮窗内反馈阶段33.txt`
- 下载文件 SHA-256：`2178d6827ed5c4d88e1bf1cfd63c2c5fa29a9f1a3318b4fa6a1692712e926d1c`
- 新模块：`src/sbh_36_back_inline_feedback.js`
- 新模块 SHA-256：`23324c9d2b80a76e1d77957c548efbb0964b184cb779d965b736dcab584e0f22`
- 入口版本：`38`
- 模块集版本：`20260803.08`
- 模块数量：`21`
- 状态：实现完成，真机验证待执行

## 1. 系统返回实现

Android 13 及以上使用窗口级返回回调：

```text
root.findOnBackInvokedDispatcher()
    ↓
registerOnBackInvokedCallback(PRIORITY_OVERLAY, callback)
```

返回行为：

```text
当前为二级页面 → 同步渲染首页
当前为首页     → 注销 callback 并关闭浮窗
```

旧的 `KEYCODE_BACK` 监听仍保留为兼容回退，但不再作为 Android 14 主路径。

入口输出新增：

```json
{
  "systemBackRegistrationAttempted": true,
  "systemBackDispatcherAvailable": true,
  "systemBackCallbackRegistered": true,
  "systemBackRegistrationMode": "on_back_invoked_overlay",
  "systemBackPriority": 1000000,
  "systemBackRegistrationError": null,
  "legacyBackKeyFallbackInstalled": true
}
```

控制器状态记录：

```text
backInvocationCount
lastBackSource
lastBackAction
lastBackAt
```

## 2. 浮窗内反馈

全局 `SBH.util.toast()` 在浮窗可见时改为更新浮窗内状态条：

- 位置：底部导航上方；
- 高度：`48dp`；
- 左右边距：`18dp`；
- 底部边距：`78dp`；
- 成功、进行中、锁定和失败使用不同语义色；
- 点击状态条可以手动隐藏；
- 状态条属于 root 覆盖层，不会随首页内容重建而丢失。

浮窗未创建或已经关闭时，仍回退到原系统 Toast。

入口输出新增：

```json
{
  "inlineFeedbackReady": true,
  "toastRoutedToInlineFeedback": true,
  "inlineFeedbackPersistentUntilNextAction": true
}
```

## 3. 真机测试门禁

启动 JSON 至少满足：

```text
entryVersion=38
moduleSetVersion=20260803.08
app.startupUiReady=true
app.runtimeUiActionsReady=true
app.inlineFeedbackReady=true
app.systemBackRegistrationAttempted=true
app.systemBackDispatcherAvailable=true
app.systemBackCallbackRegistered=true
app.systemBackRegistrationMode=on_back_invoked_overlay
app.systemBackRegistrationError=null
```

交互测试：

1. 点击“握手”，浮窗内显示握手成功或失败结果；
2. 点击“门禁”，浮窗内显示写操作锁定结果；
3. 点击“刷新”，浮窗内显示刷新完成结果；
4. 打开“节点”页，系统侧滑返回应回到首页；
5. 首页再次系统侧滑返回，应关闭浮窗；
6. 重新打开后右上角关闭按钮仍正常；
7. 操作全过程不得启动 Core、TUN，不得修改路由、配置或 Runtime 文件。

通过后允许进入正式入口提升和 UI 视觉收尾。
