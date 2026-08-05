# Runtime Stage 44 Retry 2 — 临时权限桥接

## 真机结果

Stage 44 Retry 1 启动正常，但点击 `sing-box` 配置检查后返回：

- `failureStep=binary_precheck`
- `shortxExecuteActionUsed=false`
- `javaProcessBuilderUsed=false`
- 临时配置未持久化
- Runtime/Core/TUN/路由均未修改

该结果说明失败发生在 ShortX Shell 调用之前。ShortX/Rhino 进程以 `uid=1000` 运行，Java `File.isFile()/canExecute()` 无法穿透 Root Runtime 目录权限；不能据此判断 Root Shell 下的 `sing-box` 不存在。

## Retry 2 方案

新增 `sbh_58_binary_permission_bridge.js`，在单次检查期间：

1. 使用 ShortX `ShellCommand`（uid=0）读取以下四个对象的精确八进制模式：ShortX 根目录、`SingBoxHub` 目录、`bin` 目录和 `sing-box` 文件；
2. 将原始模式写入客户端缓存中的 0600 恢复状态文件；
3. 仅临时增加目录遍历权限和 `sing-box` 读取/执行权限，使 uid=1000 的旧 Java 预检查能够通过；
4. 调用已经存在的 Stage 44 Retry 1 检查链；
5. 回调前按原始模式逐项恢复，并删除恢复状态文件；
6. 下次启动若发现遗留状态文件，先执行恢复，再开放 UI。

不递归修改目录，不修改 Runtime 文件内容，不替换生产配置，不启动 Core/TUN，不修改路由或 DNS。

## 安全门禁

- `binaryPermissionBridgeTemporaryOnly=true`
- `binaryPermissionBridgeExactModeRestore=true`
- `binaryPermissionBridgeRuntimeContentModified=false`
- 检查结果必须包含 `permissionBridgeRestored=true`
- `runtimeMetadataCurrentlyModified=false`
- 恢复失败时强制令结果 `ok=false`

## 版本

- Entry：59
- Module set：`20260803.20`
- Module count：37
- 新模块 SHA-256：`5223b982bfc88d8c255d080ba6fe56405b4ccfda8b5872b37fb73487ca42904e`
