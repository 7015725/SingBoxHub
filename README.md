# SingBoxHub

SingBoxHub 是面向 **Android 14 / Root / ShortX / Rhino ES5** 环境的 sing-box 控制与自动化项目。

项目目标不是重新实现代理核心，而是在官方 sing-box Core 之上提供可验证、可回滚、可自动化的本地控制层。

## 当前状态

- 开发阶段：`V0.1 Runtime Prototype`
- 目标平台：Android 14 / SDK 34 / arm64-v8a
- 脚本环境：ShortX / Rhino ES5
- 已验证 Core 基线：sing-box `1.13.12`
- Runtime 生命周期、隔离 TUN 与受控本地数据路径已完成阶段性验证
- Phase 4 路由共存与异常退出残留清理仍在加固，尚不作为生产完成状态

## 架构基线

```text
ShortX Rhino ES5 UI / Automation
        ↓
Runtime Client DEX
        ↓
Authenticated Local IPC
        ↓
Isolated Runtime Daemon
        ↓
Process / Config / Route Control
        ↓
Official sing-box Core
```

## 安全边界

- 使用独立目标接口 `sbh-tun0`，不得破坏现有 `tun0`
- 禁止宽泛 `pkill`，只允许控制已确认的精确 PID
- 配置启用前必须执行校验
- 更新必须经过 SHA-256、备份、替换、启动检测与失败回滚
- 路由、规则、TUN、临时文件必须具备精确所有权和清理契约
- 仓库不提交凭据、订阅内容、设备数据库、运行日志或本机生成的二进制状态

## 目录

```text
SingBoxHub/
├── entry/       # ShortX Rhino ES5 入口
├── runtime/     # 独立 Runtime 与控制协议
├── modules/     # 业务模块
├── ui/          # Canvas / WindowManager UI
├── config/      # 配置模板与 schema
├── database/    # SQLite schema 与迁移
├── cache/       # 仅保留目录说明，不提交运行缓存
├── metadata/    # 版本、清单与校验结构
├── probes/      # 真机能力探测与阶段验证
├── scripts/     # 构建、安装、验证和维护脚本
└── docs/        # 设计、ADR 与实施记录
```

## 路线图

- **V0.1**：Runtime 核心、进程控制、配置生成、回滚与异常恢复
- **V0.2**：Canvas UI、动态尺寸、深色主题、无变化停帧
- **V0.3**：订阅、节点、搜索、延迟与日志
- **V1.0**：更新安全、自动化、完整测试与正式发布

## 开发约束

Rhino 侧代码严格使用 ES5：

- 使用 `var`
- 禁止 `let`、`const`、箭头函数、`class` 和模板字符串
- Android API 调用必须明确 SDK 边界
- UI 尺寸采用动态 dp 计算，不使用设备相关硬编码
- 核心架构变更必须通过 ADR 记录

## 许可

许可证尚未确定。在许可证加入前，保留全部权利。
