# Config

存放可公开的配置模板、JSON Schema、默认值和迁移规则。

## 处理流程

```text
生成候选配置
→ schema / 语义校验
→ sing-box check
→ 原配置备份
→ 原子替换
→ 启动检测
→ 失败回滚
```

真实订阅、凭据、设备专用配置和运行中的 `runtime*.json` 已由 `.gitignore` 排除。
