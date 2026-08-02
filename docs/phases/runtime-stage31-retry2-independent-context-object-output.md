# Runtime 阶段 31 重试 2：独立 Rhino 上下文导致诊断无效

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 阶段：`runtime_stage31_retry2_active_window_diagnostic_recovery`
- 真机输出：`[object Object]`
- UI：未显示新窗口
- 状态：方案无效，不再沿用

## 1. 结果

Retry 2 作为独立 ShortX JS 任务执行后，只返回：

```text
[object Object]
```

且没有创建新 UI。

## 2. 根因

### 2.1 返回值未序列化

脚本直接返回 JavaScript 对象，当前 ShortX 结果通道调用对象字符串表示，因此显示为 `[object Object]`，未得到结构化 JSON。

### 2.2 不同 JS 任务不共享 Rhino 全局对象

Retry 2 试图读取：

```text
global.__SBH_APP__.controller
```

但上一条 Stage 31 入口和当前独立诊断脚本属于不同 ShortX JS 执行上下文。上一任务的 JavaScript 全局对象、闭包和 `__SBH_APP__` 不能从新任务直接访问。

因此该脚本无法读取或修改旧窗口控制器，也不会自动创建新窗口。

## 3. 阶段结论

以下方案被否决：

- 通过另一条独立 JS 任务直接操作上一任务中的控制器；
- 依赖任务间共享 JavaScript `global`；
- 在未 `JSON.stringify()` 时直接返回诊断对象。

下一步必须把修复放入同一模块加载链，在窗口创建任务自身的 UI 回调内完成首次页面渲染。

## 4. 安全边界

Retry 2 未读取 endpoint、token 或 socketName，未连接 LocalSocket，未调用 Runtime 请求，也未操作 Core、TUN、路由或配置。
