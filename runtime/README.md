# Runtime

独立 Runtime、DEX/JAR 客户端、IPC 协议与 Core 生命周期实现放在此目录。

## 边界

- Runtime 与 ShortX UI 生命周期解耦
- 控制端点仅允许本地访问并需要认证
- 只控制精确 PID，不使用宽泛进程匹配
- 所有 TUN、路由、规则和临时状态必须具备所有权记录与清理契约
- 生成的 JAR、DEX、控制端点、PID、Socket 和运行状态不得直接提交
