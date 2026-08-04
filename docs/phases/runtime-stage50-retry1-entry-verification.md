# Runtime Stage 50 Retry 1：测试入口校验

## 入口

- 文件名：`SingBoxHub_Stage50前置门禁只读诊断重试1.txt`
- 入口版本：`69`
- 基础模块集：`20260803.22`
- 内联模块：`sbh_69_runtime_core_start_preflight_diagnostic.js`
- 内联完整源码 SHA-256：`b7ebb789afac51d2659e5b2e0c6d9667ac9b0f3d4b278bffeed6795b928aee16`
- 完整入口 SHA-256：`4e63df9b19165da9b0c32f9918ef34472cde70e8cb7f8e5f0256fa9a1077bc76`

## 启动方式

入口只加载本地已验证的 Stage 45 基础模块集，再以内联方式加载 Retry 1 只读诊断模块：

- 不读取远程 manifest；
- 不下载模块；
- 不执行 Core 启动；
- 不修改 Runtime 文件；
- 不消费新的 Core 启动授权。

## 校验

- 入口 JavaScript 语法检查通过；
- 内联源码 SHA-256 与入口声明一致；
- 诊断模块 JavaScript 语法检查通过；
- 生成 Shell 通过 `sh -n`；
- 正常和陈旧 PID 隔离夹具均输出 `DONE=1`。
