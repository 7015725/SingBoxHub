# Runtime 阶段 31：认证成功但 UI 主体未渲染

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 阶段：`runtime_stage31_ui_integration`
- 入口版本：`31`
- 模块集版本：`20260803.01`
- 状态：Runtime 认证链路通过；UI 集成门禁未通过

## 1. 真机 Runtime 结果

```json
{
  "ok": true,
  "runtimeAttached": true,
  "runtimeAuthenticatedStatusAdapter": "ready",
  "runtimeTransport": "android_local_socket_authenticated_ping",
  "runtimeState": "stopped",
  "controlServicePid": 11451,
  "controlServiceHealthy": true,
  "authenticatedPingVerified": true,
  "requestCount": 1,
  "responseStatus": "PONG",
  "responseStatusMatched": true,
  "correlationMatched": true,
  "runtimeFilesModified": false,
  "coreStartInvoked": false,
  "tunCreated": false,
  "routeModified": false,
  "configModified": false
}
```

认证只读 Runtime 适配器本身通过，且没有扩大写操作范围。

## 2. UI 结果

截图显示：

- 顶部品牌栏正常；
- 状态徽标已更新为“只读已接入”；
- 关闭按钮正常显示；
- 页面主体为空白；
- 底部导航未显示。

JSON 完成时间约为 `05:27:26`，截图时间为 `05:28:22`。空白状态持续约 56 秒，因此不是窗口首次 `60ms` 延迟渲染尚未执行的瞬态。

## 3. 启动顺序证据

Stage 31 适配器版本 1 的启动顺序为：

```text
调用旧 app.start()
    ↓
创建并排队打开窗口
    ↓
暂存旧 app.start() 发起的首次 refreshAsync 回调
    ↓
同步执行认证 PING
    ↓
释放暂存回调并尝试刷新首页
```

该顺序存在窗口 attached 与首页刷新之间的竞争：如果回调释放时控制器尚未完成 attached，旧逻辑会跳过 `showPage(0)`。返回 JSON 中 `runtimeAuthenticatedStatusAdapter=ready`，但 `runtimeWriteGate=checking`，也说明应用初始输出仍保留了认证完成前的 UI 状态快照。

## 4. 阶段判定

Stage 31 不判定为完整通过：

- Runtime 协议门禁：通过；
- UI 主体渲染门禁：失败；
- 正式入口提升：禁止；
- Core 启停、TUN、路由和配置写入：继续禁止。

下一步只修复 UI 渲染顺序，不重复 Stage 30 协议验证，也不修改 Runtime 服务端。
