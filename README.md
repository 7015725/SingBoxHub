# SingBoxHub

SingBoxHub 是面向 **Android 14、Root、ShortX 与 Rhino ES5** 环境的 sing-box 本地控制与自动化项目。

项目不重新实现代理核心，而是在官方 sing-box Core 之上提供一个具备明确资源所有权、生命周期管理、异常恢复、配置校验和安全回滚能力的本地控制层。

> [!WARNING]
> 当前仓库仍处于 Runtime 原型与真机验证阶段，尚未形成可直接安装或日常使用的完整版本。不要将当前脚本直接用于生产代理环境。

## 项目定位

SingBoxHub 计划统一处理以下能力：

- sing-box Core 的安装、校验、启动、停止和状态查询；
- 配置生成、启用前校验、版本留档和失败回滚；
- 独立 TUN、策略路由及残留资源的精确清理；
- ShortX Rhino ES5 自动化入口；
- Android `WindowManager + Canvas + 原生控件` 管理界面；
- 节点、订阅、延迟、日志和运行状态管理；
- 二进制与模块更新的哈希校验、备份和恢复。

### 非目标

- 不修改或重新实现 sing-box Core；
- 不接管设备上其他 VPN、代理应用或未知路由资源；
- 不使用宽泛进程终止、全局路由清理或不可审查的修复命令；
- 不在仓库中保存订阅、凭据、设备数据库、运行日志或本机生成状态。

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 开发阶段 | `V0.1 Runtime Prototype` |
| 目标平台 | Android 14 / SDK 34 / arm64-v8a |
| 自动化环境 | ShortX / Rhino ES5 |
| sing-box 验证基线 | `1.13.12` |
| Runtime 生命周期 | 阶段性验证通过 |
| 隔离 TUN | 阶段性验证通过 |
| Phase 4A 路由共存预检 | 通过 |
| Phase 4B `auto_route` 残留恢复 | 通过 |
| Phase 4B 修正版生命周期收口 | 待重测 |
| Phase 4C 路由策略集成 | 尚未开放 |
| 完整 UI | 尚未实现 |
| 正式发布 | 尚未开放 |

当前生产控制器 SHA-256：

```text
d15568f21d468730cb208a3c5080da0b956722206d8b7b25dfc88dbf7c4d6092
```

当前阶段门禁：

```text
phase4bResidualRecoveryPassed=true
productionControllerCleanupUpgraded=true
productionTunRuntimeRecovered=true
phase4bControlledAutoRouteRetestReady=true
phase4cRoutingPolicyIntegrationReady=false
```

## 已验证结论

Phase 4B 真机恢复测试已确认：

- sing-box Core 被精确 `SIGKILL` 后，`sbh-tun0` 会消失；
- 路由表 `20240` 中的受控路由会消失；
- 规则优先级 `8800–8810` 可能保留 `goto`、`nop` 和 `lookup 20240` 规则；
- 新版清理器可识别并清理白名单内的完整 `auto_route` 规则族；
- 预留范围内出现未知规则时，清理器会停止，不执行盲目删除；
- Clash 的 `tun0`、地址和所有者在恢复测试前后保持不变；
- 测试未修改防火墙、DNS 或默认路由，`system_server` 保持稳定。

详细记录见：[`docs/phases/phase4b-auto-route-residual-recovery.md`](docs/phases/phase4b-auto-route-residual-recovery.md)。

## 架构基线

```text
ShortX Rhino ES5 UI / Automation
                │
                ▼
        Runtime Client DEX
                │
                ▼
    Authenticated Local IPC
                │
                ▼
      Isolated Runtime Daemon
                │
                ▼
 Process / Config / Route Control
                │
                ▼
      Official sing-box Core
```

### 分层职责

| 层级 | 主要职责 |
| --- | --- |
| ShortX 入口 | 启动请求、UI 调用、自动化触发和结果展示 |
| Runtime Client | 参数校验、协议封装和受控 IPC 调用 |
| Runtime Daemon | 生命周期、状态机、锁、超时和资源所有权 |
| Controller | Core、配置、TUN、路由、更新和回滚操作 |
| sing-box Core | 官方代理核心及其原生能力 |

UI 的显示与关闭不得直接决定 Runtime Core 是否停止。核心生命周期必须由显式控制命令和状态机管理。

## 安全边界

### 进程

- 禁止使用宽泛 `pkill`、`killall` 或基于模糊名称的终止方式；
- 只允许操作经过 PID、启动记录和所有权校验的目标进程；
- 所有启动与停止操作必须具备超时、状态确认和最终清理步骤。

### TUN 与路由

- 使用独立目标接口 `sbh-tun0`，不得破坏现有 `tun0`；
- `auto_route` 清理只允许处理路由表 `20240`；
- 规则清理只允许处理优先级 `8800–8815`；
- 删除前必须逐条验证规则是否属于受控白名单；
- 预留范围出现未知规则时必须停止并报告冲突；
- 不得清理其他应用、系统或用户创建的接口、规则和路由。

### 配置与更新

- 配置启用前必须执行 sing-box 配置检查；
- 更新必须经过 SHA-256 校验；
- 替换前必须生成可恢复备份；
- 替换后必须执行启动与健康检查；
- 检查失败必须恢复上一版本；
- 凭据和订阅数据不得写入 Git 历史。

## 当前实现

```text
runtime/controller/auto-route-cleanup-contract.sh
```

严格限制资源范围的 `auto_route` 清理契约，负责验证并清理 SingBoxHub 所有的受控规则。

```text
scripts/verify-phase4b-recovery.sh
```

验证控制器哈希、残留清理、生产启动与停止，以及 Clash `tun0` 共存状态。

```text
docs/phases/phase4b-auto-route-residual-recovery.md
```

记录 Phase 4B 根因、修复边界、真机结果和下一阶段门禁。

```text
entry/SingBoxHub.js
```

ShortX Rhino ES5 入口骨架。当前保持无副作用，不会自动启动 Core、创建 TUN、修改路由或建立持久进程。

## 仓库结构

```text
SingBoxHub/
├── entry/       # ShortX Rhino ES5 入口
├── runtime/     # Runtime、控制协议、守护进程与控制器
├── modules/     # 配置、节点、订阅、日志等业务模块
├── ui/          # WindowManager、Canvas 与原生控件 UI
├── config/      # 配置模板、默认值与 schema
├── database/    # SQLite schema、DAO 约定与迁移
├── cache/       # 运行缓存说明，不提交真实缓存
├── metadata/    # 版本、manifest、哈希与发布元数据
├── probes/      # 真机能力探测与阶段验证
├── scripts/     # 构建、安装、校验和维护脚本
└── docs/        # 设计文档、ADR、阶段记录与测试基线
```

文档索引：[`docs/README.md`](docs/README.md)

## 开发路线

### V0.1 — Runtime Prototype

- [x] 仓库和模块边界初始化；
- [x] sing-box `1.13.12` Android arm64 基线验证；
- [x] 进程生命周期阶段性验证；
- [x] 独立 TUN 与受控数据路径阶段性验证；
- [x] Phase 4A 路由共存预检；
- [x] Phase 4B `auto_route` 残留恢复；
- [ ] 使用新版清理契约重跑 Phase 4B 生命周期收口；
- [ ] 完成 Runtime daemon 与认证 IPC；
- [ ] 完成配置事务、状态机和自动回滚。

### V0.2 — Management UI

- [ ] WindowManager 管理窗口；
- [ ] Canvas 状态绘制与无变化停帧；
- [ ] 动态 dp 尺寸、横竖屏适配和深色主题；
- [ ] SQLite 几何位置与窗口尺寸记忆；
- [ ] 可逆 IME 避让和统一系统返回链。

### V0.3 — Data and Operations

- [ ] 订阅与节点管理；
- [ ] 搜索、筛选和策略分组；
- [ ] 延迟测试和运行日志；
- [ ] 配置版本历史与快速恢复；
- [ ] 安全更新通道。

### V1.0 — Stable Release

- [ ] 完整回归测试矩阵；
- [ ] 异常恢复与设备重启恢复；
- [ ] 更新、降级和数据迁移验证；
- [ ] 用户文档和正式发布包。

## 开发约束

Rhino 侧代码严格使用 ES5：

- 使用 `var`；
- 禁止 `let`、`const`、箭头函数、`class` 和模板字符串；
- Android API 调用必须明确 SDK 边界；
- 不依赖 WebView；
- UI 尺寸采用动态 dp 计算，不使用设备相关硬编码；
- Canvas 动画在状态无变化时必须停帧；
- UI 关闭不得隐式停止监听、数据库或 Runtime；
- 关键架构变更必须通过 ADR 记录；
- 修改代码时应提供完整文件，并保留已验证边界。

Shell 脚本必须：

- 使用明确的输入、输出和退出码；
- 对危险操作设置前置验证；
- 对 PID、文件、接口、规则和路由进行精确匹配；
- 在失败路径中保留诊断信息并执行必要回滚；
- 不把“命令已执行”等同于“目标状态已达成”。

## 预期运行环境

```text
Android:       14
SDK:           34
ABI:           arm64-v8a
Root:          KernelSU 或等效 Root 环境
Automation:    ShortX
JavaScript:    Rhino ES5
Core baseline: sing-box 1.13.12
```

其他 Android 版本、厂商系统和 ABI 尚未完成兼容性验证。

## 数据与隐私

以下内容不得提交到仓库：

- 节点和订阅地址；
- API Token、密码、证书和私钥；
- 设备数据库与用户配置；
- 运行日志、崩溃日志和网络抓包；
- 本机生成的 Core、DEX、ODEX、PID、socket 和状态文件。

提交测试材料前必须移除设备标识、凭据和真实代理信息。

## 许可

许可证尚未确定。在许可证文件加入前，保留全部权利。
