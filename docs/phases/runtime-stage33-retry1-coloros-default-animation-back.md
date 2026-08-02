# Runtime 阶段 33 重试 1：ColorOS 默认优先级动画返回回调

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage33Retry1.js`
- 下载文件：`SingBoxHub_ColorOS系统返回修复阶段33重试1.txt`
- 下载文件 SHA-256：`0043df8ac0f54ad743ed4965e4aa80f4d68c8b3aaedb2585738b2ec7ee55332a`
- 新模块：`src/sbh_37_back_dispatch_repair.js`
- 新模块 SHA-256：`aaeffc7b219de58e5697041fc185c5835105208227257942faa18349764e673a`
- 模块集版本：`20260803.09`
- 入口最低版本：`39`
- 模块数量：`22`
- 状态：实现完成，真机验证待执行

## 1. 修复目标

不修改已通过的 Runtime 认证、启动渲染、同步按钮和浮窗内反馈，只替换未触发的系统返回注册路径。

## 2. 注册顺序

```text
窗口 addView 并完成 attach
    ↓
注销 Stage 33 的 PRIORITY_OVERLAY 回调
    ↓
通过 root.post() 进入 attached View 消息队列
    ↓
显式请求根 View 焦点
    ↓
Android 14 优先创建 OnBackAnimationCallback
    ↓
Class.isInstance() 校验 JavaAdapter 代理
    ↓
以 PRIORITY_DEFAULT 注册
    ↓
失败时回退 OnBackInvokedCallback + PRIORITY_DEFAULT
    ↓
旧 KEYCODE_BACK 监听继续保留
```

## 3. 选择依据

Android 官方定义：

- `OnBackAnimationCallback` 自 API 34 起可接收 started、progressed、cancelled 和 invoked；
- 回调只会分发给当前获得焦点的窗口；
- `PRIORITY_DEFAULT` 的常量值为 `0`；
- `PRIORITY_OVERLAY` 的常量值为 `1000000`。

ToolHub 的 Android 14 返回实现也使用：

- attached View 后注册；
- Android 14 优先 `OnBackAnimationCallback`；
- JavaAdapter 实例校验；
- `PRIORITY_DEFAULT`；
- 普通 `OnBackInvokedCallback` 与 Key 监听作为回退。

## 4. 输出字段

```json
{
  "systemBackRepairVersion": 1,
  "systemBackRepairRegistered": true,
  "systemBackRepairRegistrationMode": "on_back_animation_default",
  "systemBackRepairPriority": 0,
  "systemBackRepairAnimationCallbackUsed": true,
  "systemBackRepairAnimationProxyValidated": true,
  "systemBackRepairRegisteredAfterAttach": true,
  "systemBackRepairPreviousOverlayUnregistered": true,
  "systemBackRepairAttachedToWindow": true,
  "systemBackRepairRootFocused": true,
  "systemBackRepairWindowFocused": true,
  "systemBackRepairRegistrationError": null
}
```

控制器状态额外记录：

```text
backRepairStartedCount
backRepairProgressedCount
backRepairCancelledCount
backRepairInvokedCount
backRepairLastProgress
backRepairLastEventAt
```

## 5. 真机门禁

1. 启动后首页完整；
2. 浮窗内反馈继续正常；
3. 打开节点、日志或设置页面后侧滑返回，回到首页；
4. 首页侧滑返回，关闭浮窗；
5. 右上角关闭按钮继续正常；
6. 若仍失败，必须根据窗口焦点和 back progress 计数继续判断，不再只根据“注册成功”推断事件可达。

## 6. 安全边界

- 不增加 Runtime PING；
- 不轮询；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、配置或 Runtime 文件；
- 所有写操作继续锁定；
- 正式入口暂不提升。
