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
  - 在明确授权下执行一次真实 Android LocalSocket `PING`
  - 严格验证 `PONG + correlation echo`
  - token、socketName 和 correlation 均不输出、不缓存
  - 授权只消费一次，后续运行只读取脱敏缓存
  - 持续锁定所有生命周期、TUN 和路由修改命令

设计冻结后的核心架构变更必须新增 ADR，不直接覆盖历史结论。
