# Runtime Stage 50 真机结果：前置门禁未完成，Core 未启动

## 结论

Stage 50 首次真机执行未进入 Core 派发阶段。

返回结果：

- `ok=false`
- `stage=production_stage50_runtime_core_start_probe`
- `errorCode=CORE_START_PREFLIGHT_FAILED`
- `authorizationConsumed=true`
- `automaticRetryAllowed=false`
- `manualOnly=true`
- `preflightPassed=false`
- `preflightShellCode=158`
- `preflightCompletionMarkerObserved=false`

运行边界：

- `coreStartInvoked=false`
- `coreStopInvoked=false`
- `tunCreated=false`
- `routeModified=false`
- `destructiveOperations=false`

因此本次结果不存在 Core 启动状态不明问题，也不需要执行进程回滚或网络资源清理。

## 现有诊断不足

Stage 50 原实现使用多个 `exit 211–233` 表示具体前置门禁失败，但 ShortX ShellAction 返回的 `shellCode=158` 不是脚本实际退出码，并且原结果未返回 Shell 内已经输出的阶段标记。

由于 `preflightCompletionMarkerObserved=false`，当前只能确认前置脚本在最终完成标记之前停止，无法仅凭本次 JSON 判断是以下哪一项阻断：

- Runtime 目录或文件类型；
- 生产配置权限、所有权或哈希链；
- staging 数量或文件类型；
- `sing-box check`；
- 活动 PID/元数据残留；
- 已存在的匹配 Core；
- `sbh-tun0`、规则 `8800–8815` 或路由表 `20240` 残留。

## 处理决定

禁止直接重复执行 Stage 50 Core 启动。

下一步改为 Stage 50 Retry 1 只读门禁诊断：

1. 不消费新的 Core 启动授权；
2. 不创建或修改 Runtime 文件；
3. 不启动或停止 Core；
4. 不修改 TUN、路由、DNS 或防火墙；
5. 重新读取全部前置条件；
6. 返回首个阻断门禁及对应原始退出码；
7. Shell 始终输出完成标记，避免 `shellCode=158` 掩盖实际结果。

只有只读诊断完成后，才决定修复阻断项或生成修正版 Core 启动入口。
