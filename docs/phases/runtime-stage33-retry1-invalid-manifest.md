# Runtime 阶段 33 重试 1：manifest 顶层校验失败

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`39`
- 预期模块集：`20260803.09`
- 预期模块数量：`22`
- 状态：启动失败，未创建浮窗

## 真机结果

```json
{
  "ok": false,
  "project": "SingBoxHub",
  "entryVersion": 39,
  "started": false,
  "status": "full_ui_bootstrap_failed",
  "runtimeAttached": false,
  "destructiveOperations": false,
  "error": "Error: Invalid module manifest"
}
```

## 判定

错误发生于 bootstrap 的 `validateManifest()` 顶层检查，早于模块下载、SHA-256 校验、编译和 UI 创建。

仓库当前 manifest 的静态结构为：

```text
schemaVersion=1
moduleSetVersion=20260803.09
entryMinVersion=39
sourceRef=agent/runtime-client-readonly-20260802
modules=22
```

入口也声明 22 个同序模块。因此，本次现象与可变分支 raw 地址在连续提交后短暂返回上一版 manifest 的情况一致：入口版本已更新为 39，但获取到的 manifest 仍可能是 `20260803.08`、21 模块，从而触发通用的 `Invalid module manifest`。

该判断属于基于错误位置和仓库现状的推断；失败 JSON 没有暴露实际下载到的 manifest 内容。

## 安全边界

本次失败发生在模块加载前：

- 未创建浮窗；
- 未连接 Runtime；
- 未发送 PING；
- 未启动或停止 Core；
- 未创建 TUN；
- 未修改路由或配置。

下一次入口固定从同一个 Git commit 读取 manifest 和全部模块，消除分支 raw 缓存交叉。
