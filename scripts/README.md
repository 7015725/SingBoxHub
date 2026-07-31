# Scripts

构建、安装、升级、恢复和校验脚本目录。

Shell 脚本必须：

- 兼容 Android `/system/bin/sh`
- 使用精确路径、PID、接口、路由表和规则范围
- 禁止宽泛删除或进程终止
- 在写入生产文件前备份并验证哈希
- 具备超时、信号捕获和幂等清理
- 最终输出可机器解析的 JSON 状态

## 当前脚本

- `verify-phase4b-recovery.sh`
  - 校验生产控制器、配置和 manifest 哈希
  - 确认表 `20240` 与规则范围 `8800–8815` 无残留
  - 执行一次生产 `auto_route=false` 启动/停止 sanity cycle
  - 验证二次清理幂等
  - 精确核对 Clash `tun0` 所有者前后未变化

对应恢复基线：

```text
metadata/phase4b-recovery-baseline.json
```
