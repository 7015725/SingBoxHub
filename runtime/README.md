# Runtime

独立 Runtime、DEX/JAR 客户端、IPC 协议与 Core 生命周期实现放在此目录。

## 边界

- Runtime 与 ShortX UI 生命周期解耦
- 控制端点仅允许本地访问并需要认证
- 只控制精确 PID，不使用宽泛进程匹配
- 所有 TUN、路由、规则和临时状态必须具备所有权记录与清理契约
- 生成的 JAR、DEX、控制端点、PID、Socket 和运行状态不得直接提交

## 当前实现

- `controller/auto-route-cleanup-contract.sh`
  - 预留接口：`sbh-tun0`
  - 预留路由表：`20240`
  - 预留规则范围：`8800–8815`
  - 支持 sing-box `auto_route` 生成的 `goto`、`nop`、`lookup` 与 `[detached]` 规则
  - 删除前逐条白名单验证
  - 发现未知规则时立即停止，不执行宽泛清理

生产设备上已验证的完整控制器 SHA-256：

```text
d15568f21d468730cb208a3c5080da0b956722206d8b7b25dfc88dbf7c4d6092
```

仓库中的 cleanup contract 是生产控制器的可审查源模块；设备 Runtime、控制端点、PID、Socket 和生成状态仍不得提交。
