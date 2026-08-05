# Runtime 阶段 35：严格激活正式只读 UI 模块集

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 隔离入口：`entry/SingBoxHub.stage35.strict-module-activation.js`
- 入口版本：`48`
- 目标模块集：`20260803.10`
- 模块数：21
- 状态：待真机验证

## 目标

验证 `20260803.10` 在线模块集本身可被完整下载、SHA-256 校验、Rhino 编译、激活并启动。禁止再用设备旧缓存回退掩盖正式模块集错误。

## 修复

入口模块列表第 21 项修正为：

```text
sbh_42_inline_feedback.js
```

manifest 和全部模块固定读取同一不可变提交：

```text
71fce85a6f63d8ceb71c1c5110010fc65386401f
```

## 严格策略

- 远端 manifest 校验失败：直接失败；
- 模块下载、SHA-256 或 Rhino 编译失败：直接失败；
- 本地新模块集加载失败：直接失败；
- 不读取 active/lastGood 作为本轮回退候选；
- `fallbackAllowed=false`；
- 只有目标模块集实际启动才返回 `moduleSetActivated=true`。

## 通过门禁

必须同时满足：

```text
ok=true
entryVersion=48
moduleSetVersion=20260803.10
stage=runtime_stage35_strict_module_activation
strictModuleActivation=true
fallbackAllowed=false
moduleSetActivated=true
sync.remoteAvailable=true
sync.warning=null
sync.fallback=false
expectedLastModule=sbh_42_inline_feedback.js
```

同时检查：

- 首页、节点、日志、设置页面正常；
- 浮窗顶部不进入状态栏；
- 握手、门禁、刷新反馈正常；
- 右上角关闭按钮正常；
- 系统返回已延期，不是本阶段门禁；
- 只发送一次认证 PING；
- 不启动 Core、TUN，不修改路由、配置或 Runtime 文件。

## 下一阶段

Stage 35 通过后：

1. 将入口版本 48 和模块集 `20260803.10` 提升到正式 `entry/SingBoxHub.js`；
2. 固化稳定只读 UI 基线；
3. 进入订阅数据链阶段，先实现本地订阅模型和只读列表，不立即执行网络更新或 Runtime 写操作。
