# UI

ShortX `WindowManager + Canvas + 原生控件` UI 实现目录。

## 当前实现

莫奈极简四页面原型当前直接集成在：

```text
entry/SingBoxHub.js
```

设计与真机测试基线：

```text
docs/ui/monet-ui-replica.md
```

当前原型包含首页、节点与订阅、运行日志、自动化与设置四个页面。所有 Runtime 操作仍为非破坏性占位反馈，尚未连接 sing-box Core、TUN、路由或配置控制器。

## 约束

- 尺寸通过 density、可用窗口和系统 Insets 动态计算
- 禁止依赖单一设备分辨率的硬编码布局
- 支持亮色与深色主题
- 窗口位置和尺寸通过 SQLite 持久化
- Canvas 在无视觉变化时停帧，避免持续刷新
- UI 关闭不得停止 Runtime、监听、数据库或控制端点
- 不使用受限 WebView 作为核心界面
- 节点、订阅和日志演示数据不得包含真实凭据

## 当前阶段边界

已实现：

- Android 原生 View 页面结构
- Canvas 品牌图形和低透明度水彩装饰
- 四项底部导航
- density 动态 dp
- WindowInsets 系统区域避让
- `SOFT_INPUT_ADJUST_RESIZE` 输入法避让
- 单实例关闭广播
- 基础系统返回链

待实现：

- SQLite 几何和设置持久化
- 深色模式和系统动态色
- 完整可逆 IME 状态机
- Runtime Client 只读状态
- 真实订阅、节点、日志和诊断数据
- 经验证的受控启动、停止、重载和回滚接口
