# Runtime 阶段 31 重试 5：显式窗口几何修复

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage31Retry5.js`
- 下载文件：`SingBoxHub_UI显式几何修复阶段31重试5.txt`
- 下载文件 SHA-256：`61d0f6bdc720490f22826ff45898ed966c624e1f17583a9b66eff8ecf6dd16e9`
- 新模块：`src/sbh_33_window_explicit_geometry.js`
- 新模块 SHA-256：`7dffe40eda3198d88ad33d54ab006465451344ce1c7cebcc5d610e8b6bbdaccd`
- 模块集版本：`20260803.05`
- 入口最低版本：`35`
- 模块数量：`18`
- 状态：实现完成，真机验证待执行

## 1. 根因依据

Retry 4 已确认：

```text
firstRenderSynchronous=true
firstRenderContentChildCount=1
firstRenderNavChildCount=1
```

因此页面和导航已经构建，问题位于布局和测量阶段，不再是回调或页面工厂未执行。

## 2. 修复方案

候选模块在原控制器创建后重写 `buildRoot()`，将原纵向 `LinearLayout` 壳替换为显式 `FrameLayout`：

```text
顶部栏：MATCH_PARENT × 72dp，Gravity.TOP
content：MATCH_PARENT × MATCH_PARENT
         topMargin=72dp
         bottomMargin=68dp
底部导航：MATCH_PARENT × 68dp，Gravity.BOTTOM
```

由此移除首次主界面对 `LinearLayout.LayoutParams(height=0, weight=1)` 的依赖。

窗口打开过程固定为：

```text
主线程 buildRoot
    ↓
WindowManager.addView
    ↓
attached=true
    ↓
同步 renderNow(0)
    ↓
按显示屏像素执行 EXACTLY measure/layout
    ↓
检查 content/nav 子视图和 measuredHeight
    ↓
返回入口结果
```

## 3. 新增返回字段

```json
{
  "explicitGeometryApplied": true,
  "firstRenderSynchronous": true,
  "contentChildCount": 1,
  "navChildCount": 1,
  "contentMeasuredHeight": 1,
  "navMeasuredHeight": 1,
  "uiGeometryReady": true,
  "runtimeWindowGeometry": {
    "rootMeasuredWidth": 0,
    "rootMeasuredHeight": 0,
    "shellMeasuredWidth": 0,
    "shellMeasuredHeight": 0,
    "contentMeasuredWidth": 0,
    "contentMeasuredHeight": 0,
    "navMeasuredWidth": 0,
    "navMeasuredHeight": 0
  }
}
```

示例中的尺寸仅表示字段结构；真机值必须大于 0。

## 4. 失败即清理

如果同步渲染后出现以下任一情况：

- `contentChildCount < 1`；
- `navChildCount < 1`；
- `contentMeasuredHeight <= 0`；
- `navMeasuredHeight <= 0`；

候选窗口立即抛错并清理，不再留下只有顶部栏的半完成窗口。

## 5. Runtime 与安全边界

本次继续复用 Stage 30 认证只读适配器：

- 启动时最多发送一次认证 `PING`；
- 不轮询；
- 不自动重试；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、配置或 Runtime 文件；
- 所有写命令保持锁定。

## 6. 真机门禁

JSON 至少满足：

```text
ok=true
entryVersion=35
moduleSetVersion=20260803.05
app.runtimeAuthenticatedStatusAdapter=ready
app.authenticatedPingVerified=true
app.explicitGeometryApplied=true
app.firstRenderSynchronous=true
app.contentChildCount>0
app.navChildCount>0
app.contentMeasuredHeight>0
app.navMeasuredHeight>0
app.uiGeometryReady=true
app.runtimeFilesModified=false
```

UI 必须实际显示：

- Runtime 状态卡；
- 首页功能卡；
- 底部导航；
- “握手 / 门禁 / 刷新”按钮。

只有 JSON 和截图同时通过，才允许提升正式入口。
