# Runtime 阶段 33 重试 2：固定提交后仍触发 Invalid module manifest

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`40`
- 预期模块集：`20260803.09`
- 预期模块数：`22`
- 状态：启动失败，未创建浮窗

## 1. 真机结果

```json
{
  "ok": false,
  "project": "SingBoxHub",
  "entryVersion": 40,
  "started": false,
  "status": "full_ui_bootstrap_failed",
  "runtimeAttached": false,
  "destructiveOperations": false,
  "error": "Error: Invalid module manifest"
}
```

失败发生在应用模块执行之前，因此：

- 未创建浮窗；
- 未加载 Runtime 适配器；
- 未连接 LocalSocket；
- 未发送 PING；
- 未执行 Core、TUN、路由或配置操作。

## 2. 实际失败链

通用入口的同步顺序为：

```text
远端 fetch/parse/validate/prepare
    ↓ 任意错误均被捕获到 syncInfo.warning
读取 active 或 lastGood 指针
    ↓
使用当前入口的 MODULE_NAMES 重新校验旧本地 manifest
```

设备上的 active/lastGood 仍指向已验证的 `20260803.08`，该模块集只有 21 个模块。Stage 33 Retry 2 的入口声明为 22 个模块，因此当远端同步阶段出现任何错误时，回退加载旧本地 manifest 会再次失败，并覆盖原始同步错误，最终只返回：

```text
Error: Invalid module manifest
```

这说明两次相同错误不能证明固定提交中的 `20260803.09` manifest 内容无效；真正的远端同步错误被旧回退链隐藏。

## 3. 结论

下一次测试不再使用通用远端同步器和 active/lastGood 回退：

- 直接复用设备上已经真机通过的本地 `20260803.08` 21 模块；
- 使用入口内嵌的 `sbh_37_back_dispatch_repair.js`；
- 对全部本地模块和内嵌模块执行精确 SHA-256 校验；
- 不读取远端 manifest，不下载模块，不访问网络；
- 本地模块缺失或损坏时直接返回具体模块名。
