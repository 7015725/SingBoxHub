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
  - 严格清理契约
  - 生产控制器升级哈希
  - Clash `tun0` 共存验证
  - Phase 4B 重测与 Phase 4C 门禁

- `phases/runtime-readonly-stage24-cfg-ping-contract.md`
  - Runtime 三行请求、两行响应契约的 CFG 感知静态验证
  - `PING` 响应状态与 correlation 回显识别
  - 路径敏感寄存器、静态字段和异常边分析
  - 第 25 阶段只读 dry-run 门禁

设计冻结后的核心架构变更必须新增 ADR，不直接覆盖历史结论。
