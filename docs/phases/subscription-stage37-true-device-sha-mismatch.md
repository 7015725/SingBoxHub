# 订阅阶段 37：真机模块 SHA-256 不一致

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：49
- 目标模块集：`20260803.11`
- 结果：启动前安全失败

## 真机结果

入口返回：

```text
Strict module sync failed: SHA-256 mismatch: sbh_44_subscription_crud_ui.js
```

浮窗没有创建。由于入口启用了严格同步且禁止回退，本次失败没有加载旧模块集，也没有执行订阅 CRUD、Runtime 配置写入、Core、TUN 或路由操作。

## 根因

`module-manifest.json` 对 `sbh_44_subscription_crud_ui.js` 声明的 SHA-256 为：

```text
f94c8cdc14695bedda94394ef63e4ba05bf92618eebb7e598c3442826f2ef8bc
```

固定提交 `e8ac57f1506fae5437128713585c1494112c2376` 中的实际模块缺少生成版本中的一行未使用 `View` 声明，导致文件内容与 manifest 不一致。功能语义没有因此改变，但严格内容校验必须拒绝该模块。

## 安全结论

- 严格 SHA-256 门禁工作正常。
- 未允许 active / last-good 回退掩盖问题。
- 未创建 UI。
- 未下载订阅。
- 未写 Runtime 配置。
- 未启动 Core 或 TUN。
- 未修改路由。
