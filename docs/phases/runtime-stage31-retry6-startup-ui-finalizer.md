# Runtime 阶段 31 重试 6：抑制启动异步重绘并同步收尾

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage31Retry6.js`
- 下载文件：`SingBoxHub_UI启动异步清空修复阶段31重试6.txt`
- 下载文件 SHA-256：`18b3a5102140b3937bf2626474e5d2e9004d251f008306b5d66fd7cd363a2db6`
- 新模块：`src/sbh_34_runtime_startup_ui_finalizer.js`
- 新模块 SHA-256：`4ac7b98de22b6065430565979e31986416b2e2ec790787069537201c22b9db10`
- 模块集版本：`20260803.06`
- 入口最低版本：`36`
- 模块数量：`19`
- 状态：实现完成，真机验证待执行

## 1. 修复目标

保留已经通过的：

- 认证只读 Runtime 适配器；
- 单次 `PING / PONG / correlation`；
- 显式 FrameLayout 几何；
- 同步首次渲染。

只移除启动阶段会二次清空首页的旧异步刷新回调。

## 2. 启动顺序

Retry 6 将启动过程改为：

```text
临时拦截 SBH.runtime.refreshAsync
        ↓
执行原 app.start()
        ↓
窗口 addView + 首次同步 renderNow(0)
        ↓
旧 app.start() 的自动 refreshAsync 被记录但不执行
        ↓
认证适配器执行唯一一次 PING
        ↓
恢复正式 refreshAsync 接口
        ↓
在主线程同步应用认证徽标并最终 renderNow(0)
        ↓
同步 measure/layout
        ↓
返回最终子视图数量和实际高度
```

## 3. 请求数量

启动阶段仍只允许适配器执行一次认证请求：

```text
runtimeAuthenticatedStatusAdapterDetails.requestCount = 1
```

被抑制的是旧 app 模块的重复状态刷新回调，不是认证适配器本身。

## 4. 新增输出字段

```json
{
  "startupInitialRefreshSuppressed": true,
  "suppressedInitialRefreshCount": 1,
  "startupUiFinalizerVersion": 1,
  "startupUiFinalizationAttempted": true,
  "startupUiFinalizationError": null,
  "startupContentChildCount": 1,
  "startupNavChildCount": 1,
  "startupContentMeasuredHeight": 2210,
  "startupNavMeasuredHeight": 209,
  "startupUiReady": true,
  "runtimeWriteGate": "readonly_authenticated"
}
```

## 5. 安全边界

```json
{
  "automaticRetryAllowed": false,
  "pollingEnabled": false,
  "writeOperationsLocked": true,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "coreStopInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false,
  "destructiveOperations": false
}
```

该模块不读取 Runtime endpoint、token 或 socketName，不建立额外 LocalSocket，也不执行第二次认证请求。

## 6. 真机通过条件

```text
ok=true
entryVersion=36
moduleSetVersion=20260803.06
app.runtimeAuthenticatedStatusAdapter=ready
app.runtimeAuthenticatedStatusAdapterDetails.requestCount=1
app.runtimeAuthenticatedStatusAdapterDetails.responseStatus=PONG
app.startupInitialRefreshSuppressed=true
app.suppressedInitialRefreshCount=1
app.startupUiFinalizationError=null
app.startupContentChildCount>0
app.startupNavChildCount>0
app.startupContentMeasuredHeight>0
app.startupNavMeasuredHeight>0
app.startupUiReady=true
app.runtimeWriteGate=readonly_authenticated
```

UI 必须同时显示：

- Runtime 状态卡；
- “握手 / 门禁 / 刷新”按钮；
- 功能卡和统计区域；
- 底部导航。

通过后再单独验证三个按钮的运行时回调，不与启动修复混在同一门禁中。
