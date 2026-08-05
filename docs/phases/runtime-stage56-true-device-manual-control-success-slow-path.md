# Runtime Stage 56 真机结果：手动启停通过，但同步严格链路过慢

## 结论

Stage 56 生产生命周期手动控制闭环已通过，启动与停止均能正确工作；但用户实测单次启动或停止的等待时间接近或超过 60 秒，当前性能不适合作为正式生产交互。

本阶段判定：

- 功能验收：通过；
- 安全边界：通过；
- 交互性能：不通过；
- 下一阶段：拆分“可见完成”和“后台严格核验”。

## 真机启动结果

- Runtime 控制服务 PID：`19373`
- 新 Core PID：`32571`
- 首页显示 Core `运行中`
- 身份契约：`控制器持有`
- 网络资源：`保持为空`
- 最近操作：`start`
- UI 提示：`启动操作通过`

## 真机停止结果

- Runtime 控制服务 PID 仍为 `19373`
- Core 恢复为 `已停止`
- 网络资源继续为空
- 最近操作：`stop`
- UI 提示：`停止操作通过`

## 当前同步链路

Stage 56 的单次启动包含：

1. 完整 root Shell 快照：
   - Stage 53/55 审计；
   - 配置与 staging SHA-256；
   - `sing-box check`，上限 30 秒；
   - endpoint、Runtime PID 和所有者；
   - 全 `/proc` Core 候选扫描；
   - TUN、规则 `8800–8815`、路由表 `20240`；
2. 认证 `START`；
3. 第二次 root Shell：等待 Core 出现并稳定 4 秒；
4. 认证 `STATUS`；
5. 认证 `PING`；
6. 第三次 root Shell：写操作审计；
7. 完成 UI 回调。

停止链路同样包含完整快照、`STOP_CORE`、停止观察、`STATUS`、`PING` 和操作审计，共约三次 ShellCommand。

## 性能根因

显式业务等待只有：

- 启动发现最多 6 秒；
- 启动稳定 4 秒；
- 停止等待最多 6 秒。

这些等待不足以单独解释 60 秒以上。真机各阶段长期出现：

```text
shellCode=158
shellCodeAuthoritative=false
shellTransportCodeAnomalous=true
```

业务 marker 能完整返回，但 ShortX Shell 传输层仍可能等待固定超时。一次操作串行执行约三次 ShellCommand，因此延迟会累积。

## 下一阶段原则

Stage 57 将：

- 严格完整门禁只在低延迟模式启用时执行一次；
- `START`、`STOP_CORE`、`STATUS` 的可见路径只使用认证 LocalSocket；
- Runtime 状态收敛后立即更新首页；
- 配置哈希、进程身份、TUN、规则、路由和操作审计合并为一次后台 Shell；
- 后台核验期间锁定下一次写操作；
- 启动后台核验失败时只通过 `STOP_CORE` 回滚；
- 不发送 TERM/KILL，不使用 `pkill` 或 `killall`。
