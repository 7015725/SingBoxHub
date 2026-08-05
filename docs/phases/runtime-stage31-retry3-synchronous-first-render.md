# Runtime 阶段 31 重试 3：同步首次页面渲染

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage31Retry3.js`
- 下载文件：`SingBoxHub_Runtime同步首次渲染修复重试3.txt`
- 下载文件 SHA-256：`712d9c73e7478bd8f21d72adbc8a654b0437faa6886fb392c237ec5f48dfd924`
- 新模块：`src/sbh_32_window_synchronous_first_render.js`
- 新模块 SHA-256：`a5b14ef31496d0d03aa0b2b12181b0fde0ddfee1913ef1518af2e18d36eeebcb`
- 模块集版本：`20260803.03`
- 入口最低版本：`33`
- 模块数量：`18`
- 状态：实现完成，真机验证待执行

## 1. 根因修正

原窗口控制器在 `WindowManager.addView()` 后只设置 `attached=true`，首页和底部导航依赖 `postDelayed(60ms)` 中的 Rhino `JavaAdapter` 回调完成。

在 ShortX 单次 JS 任务中，顶部栏可在当前任务仍存活时同步创建；但延迟 JS 回调可能在任务结束后失去可靠执行环境，导致：

- 顶部栏存在；
- `content` 保持空白；
- `nav` 没有子视图；
- Runtime 徽标可被较早的状态更新修改，但完整页面未构建。

Retry 1 的额外延迟重绘仍依赖 JS 任务结束后的回调，因此没有解决同一生命周期问题。

## 2. 修复策略

新模块覆盖 `SBH.window.createController()` 返回控制器的 `open()`：

```text
将 open 工作投递到 Android 主线程
        ↓
使用 CountDownLatch 最多等待 4 秒
        ↓
buildRoot()
        ↓
WindowManager.addView()
        ↓
attached=true
        ↓
在同一个主线程回调内立即 renderNow(0)
        ↓
确认 content/nav 子视图数量均大于 0
        ↓
允许 app.start() 继续
```

首次页面不再依赖 `postDelayed()`。旧窗口模块中的延迟兜底仍可保留，但不再承担首次成功渲染职责。

## 3. 诊断字段

控制器 `status()` 新增：

```json
{
  "firstRenderSynchronous": true,
  "contentChildCount": 1,
  "navChildCount": 1,
  "firstRenderContentChildCount": 1,
  "firstRenderNavChildCount": 1
}
```

如果同步渲染后任一容器仍为空，窗口创建直接以 `SYNCHRONOUS_FIRST_RENDER_EMPTY` 失败并清理本次新窗口，不保留只有顶部栏的半完成状态。

## 4. 模块集

候选模块集为基础 UI 1–16，加：

```text
sbh_30_runtime_authenticated_status_adapter.js
sbh_32_window_synchronous_first_render.js
```

旧 `sbh_31_runtime_ui_render_recovery.js` 保留在仓库作为失败方案记录，但退出当前 manifest。

## 5. 安全边界

本次只改变 UI 首次渲染时序：

- 认证适配器仍只发送一次 `PING`；
- 不增加轮询或自动重试；
- 不读取额外敏感数据；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、配置或 Runtime 文件；
- 所有写命令继续锁定。

## 6. 真机通过条件

JSON：

```text
ok=true
entryVersion=33
moduleSetVersion=20260803.03
app.runtimeAuthenticatedStatusAdapter=ready
app.authenticatedPingVerified=true
app.runtimeAuthenticatedStatusAdapterDetails.requestCount=1
app.runtimeAuthenticatedStatusAdapterDetails.responseStatus=PONG
app.runtimeFilesModified=false
```

UI：

- Runtime 状态卡正常显示；
- “握手 / 门禁 / 刷新”按钮可见；
- 功能卡和统计区域可见；
- 底部导航可见；
- 页面切换、系统返回和关闭正常。

通过后再提升正式入口。
