# Runtime 阶段 33 重试 2：固定提交的 manifest 一致性入口

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 测试入口：`entry/SingBoxHubStage33Retry2.js`
- 下载文件：`SingBoxHub_固定提交Manifest修复阶段33重试2.txt`
- 下载文件 SHA-256：`f6ec721a8bc258cd3e47d6fc8b81b04519b8aba8caf132a59a3c8da68e2c3750`
- 入口版本：`40`
- 目标模块集：`20260803.09`
- 模块数量：`22`
- 固定模块提交：`fda82137687693c35c0ec1fbcd492ff242f6a2ad`
- 状态：实现完成，真机验证待执行

## 修复目的

之前的隔离入口从固定模板提交读取 bootstrap，但 bootstrap 内部仍使用可变分支 `agent/runtime-client-readonly-20260802` 下载 manifest 和模块。在连续提交后，raw CDN 可能短时间分别返回不同版本，导致入口模块列表与 manifest 数量不一致。

本入口保持 manifest 的逻辑 `sourceRef` 为原分支名，但把内部 `RAW_BASE` 固定为不可变提交：

```text
fda82137687693c35c0ec1fbcd492ff242f6a2ad
```

manifest 和 22 个模块因此始终来自同一提交。

## 输出字段

成功时顶层返回新增：

```json
{
  "moduleFetchMode": "single_commit_pinned",
  "pinnedModuleCommit": "fda82137687693c35c0ec1fbcd492ff242f6a2ad",
  "expectedModuleSetVersion": "20260803.09",
  "expectedModuleCount": 22
}
```

## 测试目标

1. bootstrap 不再出现 `Invalid module manifest`；
2. 浮窗正常创建；
3. Stage 33 的浮窗内反馈保持正常；
4. 验证 ColorOS 返回修复注册字段；
5. 二级页面侧滑返回首页；
6. 首页侧滑关闭浮窗。

## 安全边界

本次只修复模块下载一致性和系统返回回调：

- Runtime 仍为只读；
- 不开放 Core start/stop；
- 不创建 TUN；
- 不修改路由、配置或 Runtime 文件；
- 启动时仍只有认证适配器的一次 PING。
