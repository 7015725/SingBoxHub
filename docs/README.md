# Documentation

设计规范、阶段实施记录、架构决策记录（ADR）和真机验证结论目录。

## 文档分类

- `design/`：完整设计基线与模块设计
- `adr/`：核心架构变更及取舍
- `phases/`：Phase 0、Runtime、TUN、数据路径和路由策略实施记录
- `security/`：威胁模型、权限与凭据边界
- `testing/`：测试矩阵、结果判定和回归基线

## 阶段记录规则

1. 后续每个开发或验证阶段均在 `docs/` 下记录，不只保留聊天结论。
2. Runtime、TUN、路由和 UI 阶段实施记录优先写入 `phases/`。
3. 文档至少包含：阶段目标、输入证据、实现内容、安全边界、真机验证、结论与下一阶段门禁。
4. 新增模块时同步记录模块名、模块集版本、入口最低版本和 SHA-256。
5. 未经真机验证的结果必须明确标记为“待验证”，不得覆盖历史结论。
6. 核心架构或安全边界变更另外新增 ADR。

## 当前阶段记录

- `phases/phase4b-auto-route-residual-recovery.md`
  - Phase 4B 崩溃后 `auto_route` 规则残留根因
  - 严格清理契约与生产控制器升级

- `phases/runtime-readonly-stage24-cfg-ping-contract.md`
  - Runtime 三行请求、两行响应契约的 CFG 感知静态验证
  - `PING` 第一行响应确认是 `PONG`
  - 记录跨连接循环污染和 dry-run 阻断项

- `phases/runtime-readonly-stage25-transaction-boundary.md`
  - 建立单连接事务摘要
  - 确认 correlation 第二行回显
  - 隔离后续事务副作用污染

- `phases/runtime-readonly-stage26-sanitized-dry-run-preview.md`
  - 归一化旧适配计划阻断项
  - 生成不读取 token 原值的脱敏 PING 请求和响应预览
  - 固定真实 Socket dry-run 的独立授权门禁
  - 验证升级后单次运行直接得到结果

- `phases/runtime-readonly-stage27-socket-ping.md`
  - 首轮真实 Android LocalSocket `PING` 设计与授权边界
  - 记录直接 Java 文件读取 endpoint 的安全失败
  - 未读取 token、未连接 Socket、未发送请求

- `phases/runtime-readonly-stage27-retry1-endpoint-probe.md`
  - 使用 root Shell + Base64 endpoint probe
  - 记录固定 `uid=1000/gid=1000` 假设导致的安全失败

- `phases/runtime-readonly-stage27-retry2-process-identity.md`
  - 确认 endpoint 实际属于 `uid=0/gid=0`，权限为 `600`
  - 记录 `$TOYBOX awk` 未能提取 `/proc` UID/GID 的安全失败
  - 0 次 Socket 连接、0 次请求、0 次 token 读取

- `phases/runtime-readonly-stage27-retry3-shell-read.md`
  - 按 ShortX ShellCommand 实机调用契约读取 shellOut、shellErr、shellCode
  - 使用 Android Shell 内建 `read + case` 解析 `/proc/<pid>/status`
  - 增加 Runtime cmdline 身份绑定与 endpoint 二次 stat
  - 继续执行一次授权、一次 PING、禁止自动重试

- `phases/runtime-readonly-stage27-retry3-true-device.md`
  - Shell 内建解析不再触发 UID 解析错误
  - 确认 endpoint 中的 `runtimePid=27363` 已不存在，文件属于过期 endpoint
  - 未读取 token、未连接 Socket、未发送请求
  - 下一门禁改为先恢复或重新附加 Runtime 控制服务

- `phases/runtime-stage28-control-service-bootstrap-ping.md`
  - 直接启动 Runtime 控制服务并原子替换过期 endpoint
  - 校验新进程、endpoint 所有者和命令行身份
  - 最多执行一次只读 `PING`，不启动 sing-box 核心、TUN 或路由

- `phases/runtime-stage28-true-device-timeout.md`
  - 真机启动 Shell 在约 12 秒预算内未返回终态
  - 只确认前置检查完成，不能据此断言控制服务从未启动
  - 未读取 token、未连接 Socket、未发送请求

- `phases/runtime-stage29-bootstrap-aftermath-probe.md`
  - 只读确认控制服务、endpoint、临时文件和日志错误信号
  - 不启动或停止进程，不读取 token，不连接 Socket
  - 为分段启动重试确定精确修复路径
  - 真机验证待执行

## 架构决策

- `adr/ADR-0001-direct-control-service-bootstrap.md`
  - 不调用包含核心/TUN 清理副作用的生产 `ensure`
  - 只复用已验证的底层 `app_process` 控制服务启动协议
  - 限制写入范围和启动失败回滚范围

设计冻结后的核心架构变更必须新增 ADR，不直接覆盖历史结论。
