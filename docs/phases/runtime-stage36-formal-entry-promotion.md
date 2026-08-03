# Runtime 阶段 36：正式入口提升

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 正式入口：`entry/SingBoxHub.js`
- 入口版本：`48`
- 模块集：`20260803.10`
- 状态：待正式路径复核

## 目标

将 Stage 35 真机验证通过的入口代码原样提升到正式路径，不修改入口版本、模块集、模块顺序、固定提交、安全边界或运行语义。

## 提升内容

正式 `entry/SingBoxHub.js` 已替换为 Stage 35 的完整代码：

- 固定模板提交 `333bf86c051f746e1843bdf7ef9d4f2967a7fa52`。
- 固定模块提交 `71fce85a6f63d8ceb71c1c5110010fc65386401f`。
- 入口版本 `48`。
- 模块集 `20260803.10`。
- 模块数 `21`。
- 最后模块 `sbh_42_inline_feedback.js`。
- 禁止同步和加载失败时回退到旧模块集。

## 保持不变

- Runtime 仅执行一次认证只读 PING。
- 写操作继续锁定。
- 不启动 Core、TUN。
- 不修改路由、配置或 Runtime 文件。
- 系统侧滑返回延期。
- 不安装自定义边缘手势。
- 保留右上角关闭按钮和浮窗内操作反馈。

## 复核门禁

从正式 `entry/SingBoxHub.js` 执行一次，应满足：

- `entryVersion=48`
- `moduleSetVersion=20260803.10`
- `moduleSetActivated=true`
- `sync.fallback=false`
- `sync.warning=null`
- UI 与 Stage 35 一致
- 安全边界与 Stage 35 一致

正式路径复核通过后，进入订阅数据链阶段。
