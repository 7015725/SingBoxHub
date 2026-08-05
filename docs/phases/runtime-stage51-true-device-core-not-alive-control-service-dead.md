# Runtime Stage 51 真机结果：Core 已退出，控制服务同时失活

## 结论

Stage 51 的只读 Core 精确状态检查未通过，首个阻断门禁为：

- `blockingGate=core_process_not_alive`
- `diagnosticCode=430`
- `completionMarkerObserved=true`
- `exactStopReady=false`
- `nextAuthorizedOperation=reconcile_active_core_probe_state`

Stage 50 Retry 3 启动的 Core PID `1085` 在 2026-08-04 21:23 的启动验证时仍存活；Stage 51 于 23:36 检查时已不再存活。当前结果未返回 Core 日志正文，因此不能仅凭现有证据确定退出原因。

## Stage 51 状态检查结果

- `ok=false`
- `stage=production_stage51_runtime_core_status`
- `authorizationConsumed=false`
- `readOnly=true`
- `automaticRetryAllowed=false`
- `processAlive=false`
- `processIdentityValidated=false`
- `coreStartInvoked=false`
- `coreStopInvoked=false`
- `runtimeFilesModified=false`
- `configModified=false`
- `tunCreated=false`
- `routeModified=false`
- `networkAccessed=false`
- `destructiveOperations=false`

状态脚本在确认活动记录中的 PID 不存活后立即返回，因此以下字段为 `null`，不能把它们解释为已通过：

- 精确匹配 Core 数量；
- 生产配置检查结果；
- Core 日志字节数；
- 事务 PID 记录数量；
- IPv4/IPv6 规则与路由计数。

## Runtime 控制服务状态

Stage 51 入口启动结果同时确认：

- `runtimeAttached=false`
- `runtimeState=unavailable`
- `runtimeWriteGate=readonly_authentication_failed`
- `errorCode=CONTROL_SERVICE_NOT_ALIVE`
- canonical endpoint 仍存在且结构校验通过；
- endpoint 中记录的控制服务 PID 为 `11451`；
- `controlServiceProcessAlive=false`
- 未读取 token，未连接 LocalSocket，未发送 PING。

控制服务失活与 Core 活动记录失效是两个独立状态。当前阶段先按 Stage 51 返回的明确门禁核对并清理失效 Core 活动记录；控制服务恢复放在后续独立阶段，避免在同一事务中混合两个进程生命周期。

## 安全结论

- Stage 51 未向 PID `1085` 发送 `SIGTERM` 或 `SIGKILL`；
- 未停止其他进程；
- 未修改生产配置或 staging；
- 未修改 Core 日志；
- 未创建 TUN；
- 未修改路由、规则、DNS 或防火墙；
- 未执行网络连通性测试。

## 下一阶段

Stage 51 Retry 1：失效 Core 状态精确核对。

1. 重新验证生产配置/staging 血缘与 `sing-box check`；
2. 验证活动 PID、活动元数据、日志及事务 PID 的来源一致；
3. 确认记录 PID 不存活且系统中不存在精确匹配 Core；
4. 重新确认 TUN、规则 `8800–8815` 与路由表 `20240` 均为空；
5. 不发送任何进程信号；
6. 仅删除失效活动 PID、活动元数据和对应事务 PID；
7. 保留 Core 日志并写入核对审计；
8. 同时只读报告控制服务是否仍需恢复。
