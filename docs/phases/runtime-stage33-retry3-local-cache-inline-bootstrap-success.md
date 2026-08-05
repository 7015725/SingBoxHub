# Runtime 阶段 33 重试 3：本地验签缓存与内嵌返回模块启动成功

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`41`
- 测试模块集：`20260803.08+back37-inline`
- 启动模式：`verified_local_cache_plus_inline_module`
- 状态：启动门禁通过；系统返回行为待实际手势验证

## 1. 前序失败

Stage 33 Retry 1 和 Retry 2 均在通用模块更新器内返回：

```json
{
  "started": false,
  "status": "full_ui_bootstrap_failed",
  "error": "Error: Invalid module manifest"
}
```

实际链路为：远端同步阶段发生错误后，更新器回退到设备中的旧 `20260803.08` 本地指针；新入口再用 22 模块规则校验旧的 21 模块 manifest，最终只暴露二次错误，原始同步错误被覆盖。

## 2. Retry 3 启动策略

Retry 3 不再使用远端 manifest 或通用回退链：

1. 直接定位设备中已真机通过的 `20260803.08` 模块集；
2. 精确校验 21 个本地模块的 SHA-256；
3. 将 `sbh_37_back_dispatch_repair.js` 内嵌于测试入口；
4. 校验内嵌模块 SHA-256：
   `aaeffc7b219de58e5697041fc185c5835105208227257942faa18349764e673a`；
5. 在内存中按既定顺序加载 21 个基础模块及返回修复模块；
6. 不读取远端 manifest，不下载模块，不改写本地模块集。

## 3. 真机结果

```json
{
  "ok": true,
  "entryVersion": 41,
  "moduleSetVersion": "20260803.08+back37-inline",
  "started": true,
  "status": "full_ui_started",
  "runtimeAttached": true,
  "bootstrapMode": "verified_local_cache_plus_inline_module",
  "remoteManifestUsed": false,
  "networkAccessed": false,
  "localBaseModuleSetVersion": "20260803.08",
  "localBaseModuleCount": 21,
  "localBaseModulesVerified": true,
  "inlineModuleVerified": true
}
```

用户确认浮窗可以正常显示。

## 4. Runtime 与 UI 回归门禁

本次仍满足：

```json
{
  "runtimeAuthenticatedStatusAdapter": "ready",
  "authenticatedPingVerified": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "correlationMatched": true,
  "startupUiReady": true,
  "contentChildCount": 1,
  "navChildCount": 1,
  "inlineFeedbackReady": true,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false
}
```

## 5. 返回注册状态

启动结果显示：

```json
{
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

这些字段只证明注册、窗口 attach 和焦点门禁通过，不能替代真实返回手势验证。

## 6. 下一门禁

保持当前浮窗运行，依次验证：

1. 二级页面系统侧滑返回首页；
2. 首页系统侧滑关闭浮窗；
3. `握手 / 门禁 / 刷新` 浮窗内反馈仍正常；
4. 右上角关闭按钮仍正常。

系统返回实际通过前，不提升正式入口，也不合并当前测试链。
