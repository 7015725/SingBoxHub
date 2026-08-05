# Runtime 阶段 34 真机结果：UI 通过但正式模块集未激活

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`47`
- 目标模块集：`20260803.10`
- 实际模块集：`20260803.08`
- 结论：部分通过，不得提升正式入口

## 真机结果

UI、页面切换、浮窗内反馈、右上角关闭按钮和 Runtime 只读认证均正常。

但启动结果包含：

```text
sync.remoteAvailable=false
sync.warning=Error: Invalid module item: 20
moduleSetVersion=20260803.08
```

说明入口没有激活 `20260803.10`，而是回退到了设备中已验证的 `20260803.08`。

## 根因

Stage 34 测试入口中的 `NEW_MODULE_BLOCK` 第 21 项仍为：

```text
sbh_36_back_inline_feedback.js
```

远端 `20260803.10` manifest 第 21 项已经改为：

```text
sbh_42_inline_feedback.js
```

因此 manifest 精确校验在索引 `20` 失败。UI 正常只证明旧缓存回退仍可用，不能证明新正式模块集通过。

## 安全结果

- Runtime 认证请求数：1
- 响应：`PONG`
- correlation：匹配
- Core：未启动
- TUN：未创建
- 路由：未修改
- 配置：未修改
- Runtime 文件：未修改

## 后续门禁

Stage 35 必须：

1. 将入口第 21 个模块修正为 `sbh_42_inline_feedback.js`；
2. 固定同一 Git commit 获取 manifest 和模块；
3. 禁止 active/lastGood 回退掩盖同步错误；
4. 只有实际返回 `moduleSetVersion=20260803.10`、`sync.warning=null`、`sync.fallback=false` 才允许提升正式入口。
