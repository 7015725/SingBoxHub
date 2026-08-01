# SingBoxHub 模块化 UI 启动基线

## 分支

`agent/modular-ui-bootstrap-20260801`

## 目标

该分支停止使用“下载完整 UI 源码后直接执行”的临时方式，改为固定轻量入口、本地模块版本集、Manifest 校验、SHA-256 校验、Rhino 编译检查和 last-good 回退。

## ShortX 入口

- 主任务：`entry/SingBoxHub.js`
- 窗口开关任务：`entry/SingBoxHubToggle.js`

主任务负责同步、校验并加载本地模块。窗口开关任务只读取动态控制端点并发送 `toggle` 命令。

## 本地目录

```text
<shortx-dir>/SingBoxHub/
├── bootstrap/
│   ├── active.json
│   ├── last_good.json
│   └── update_state.json
├── modules/sets/<moduleSetVersion>/
├── data/singboxhub.db
├── cache/control_endpoint.json
├── cache/ui_status.json
├── logs/
└── state/
```

## 启动流程

1. 获取 `module-manifest.json`。
2. 校验 schema、sourceRef、entryMinVersion、模块名称、顺序和 SHA-256。
3. 下载全部模块到临时候选目录。
4. 对每个模块执行 SHA-256 和 Rhino 语法编译检查。
5. 原子切换完整模块版本集。
6. 只从本地已验证目录加载模块。
7. 创建 UI Coordinator 和动态控制端点。
8. 启动成功后写入 active 与 last-good 指针。
9. 远程同步或候选启动失败时回退到 last-good。

## 模块

```text
sbh_01_base.js
sbh_02_log.js
sbh_03_files.js
sbh_04_database.js
sbh_05_theme.js
sbh_06_widgets.js
sbh_07_window.js
sbh_08_navigation.js
sbh_09_home.js
sbh_10_subscriptions.js
sbh_11_nodes.js
sbh_12_runtime_logs.js
sbh_13_automation.js
sbh_14_runtime_client.js
sbh_15_app.js
```

## 安全边界

当前 Runtime Client 是明确的占位适配器，统一返回：

```text
RUNTIME_NOT_ATTACHED
```

当前版本不会执行 Shell，不会启动或停止 sing-box，不会创建 TUN，不会修改路由、规则、防火墙、DNS 或代理配置。

系统返回在二级页面返回首页；首页返回只隐藏 UI。隐藏 UI 不停止 Coordinator，也不代表停止未来的 Runtime。

## 第一轮真机测试

1. ShortX 授予悬浮窗权限。
2. 完整粘贴并运行 `entry/SingBoxHub.js`。
3. 首次运行应下载 15 个模块并显示四页面 UI。
4. 再次运行应复用本地模块集。
5. 断网后再次运行，应从本地已验证版本启动。
6. 单独运行 `entry/SingBoxHubToggle.js`，应隐藏或重新显示窗口。
7. 测试节点页和日志页输入框的光标、IME 弹出、收起和页面恢复。
8. 测试二级页面侧滑返回首页，以及首页侧滑隐藏窗口。
9. 点击启动、停止、重载时只能提示 Runtime 未接入，不得改变为虚假的运行状态。

## 预期主任务返回

```json
{
  "ok": true,
  "entryVersion": 3,
  "moduleSetVersion": "20260801.01",
  "status": "modular_ui_started",
  "runtimeAttached": false,
  "destructiveOperations": false
}
```
