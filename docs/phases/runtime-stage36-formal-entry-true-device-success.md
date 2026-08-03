# Runtime 阶段 36：正式入口真机验证成功

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 正式入口：`entry/SingBoxHub.js`
- 入口版本：`48`
- 模块集：`20260803.10`
- 状态：通过

## 真机结果

- 正式入口启动成功。
- 远端模块集可用，复用本地已验证模块，`downloadedCount=0`。
- `fallback=false`，`warning=null`。
- `moduleSetActivated=true`。
- 首页、节点、日志、设置、底部导航正常。
- 握手、门禁、刷新浮窗内反馈正常。
- 右上角关闭按钮正常。
- 浮窗未进入状态栏区域。

## Runtime 安全边界

- 认证 LocalSocket 请求数：1。
- 响应：`PONG`，correlation 匹配。
- 未启动或停止 Core。
- 未创建 TUN。
- 未修改路由。
- 未修改 Runtime 配置或 Runtime 文件。
- 系统侧滑返回延期，不再作为当前阶段阻塞项。

## 结论

正式只读 Runtime UI 基线完成，可以进入订阅数据链阶段。
