# UI

ShortX `WindowManager + Canvas + 原生控件` UI 实现目录。

## 约束

- 尺寸通过 density、可用窗口和系统 Insets 动态计算
- 禁止依赖单一设备分辨率的硬编码布局
- 支持亮色与深色主题
- 窗口位置和尺寸通过 SQLite 持久化
- Canvas 在无视觉变化时停帧，避免持续刷新
- UI 关闭不得停止 Runtime、监听、数据库或控制端点
- 不使用受限 WebView 作为核心界面
