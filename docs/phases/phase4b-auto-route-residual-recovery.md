# Phase 4B：auto_route 残留恢复

## 状态

- 恢复探测：`singboxhub_phase4b_auto_route_residual_recovery_001`
- 模块版本：`20260731.50`
- 结果：通过
- 结果 SHA-256：`caf0a7a4cae74cfef413740086b5b5a9f3cf336ec872f4394b3ec09fec061daa`
- 最终状态：停止

## 根因

受控 `auto_route` 生命周期测试中，sing-box 核心被精确 `SIGKILL` 后：

- `sbh-tun0` 接口自动消失；
- 路由表 `20240` 中的目标路由自动消失；
- 规则优先级 `8800–8810` 的 `goto`、`nop` 和 `lookup 20240` 规则仍然残留。

旧生产控制器只会删除直接引用 `sbh-tun0` 的简单规则，无法识别完整的 sing-box `auto_route` 规则族，因此返回 `TUN_CLEANUP_FAILED`，并阻断后续生产启动。

## 修复契约

新版清理逻辑只处理以下预留资源：

```text
目标接口：sbh-tun0
路由表：20240
规则范围：8800–8815
IPv4 TUN 前缀：172.31.255.0/30
IPv6 TUN 前缀：fdfe:7362:6833::/126
受控 IPv4 目标：198.18.0.1、198.18.0.2
受控 IPv6 目标：2001:db8::1、2001:db8::2
```

支持验证和清理的规则类型包括：

- `iif sbh-tun0 ... goto 8810`
- `[detached]` 接口规则
- IPv4 本地来源规则
- IPv6 `::/1`、`8000::/1` 跳转规则
- `lookup 20240`
- `nop`

删除前必须逐条通过白名单验证。预留范围中出现未知规则时，清理器立即停止，不执行删除。

## 真机恢复结果

恢复前检测到 IPv4 和 IPv6 残留规则，表 `20240` 已无路由，`sbh-tun0` 已不存在。

恢复后：

```text
cleanup output：TUN_CLEAN
cleanup exit code：0
IPv4 残留规则：空
IPv6 残留规则：空
IPv4 表 20240：空
IPv6 表 20240：空
```

生产 sanity test：

```text
配置检查：通过
启动：STARTED
停止：RUNTIME_STOPPED
二次清理：TUN_CLEAN
```

共存验证：

- Clash `tun0` 所有者前后均为 `com.follow.clash`；
- `tun0` 接口和地址未变化；
- 策略规则基线恢复；
- `system_server` 稳定；
- 没有修改防火墙、DNS 或默认路由；
- 没有使用宽泛进程终止。

## 生产控制器

```text
旧 SHA-256：
98ae1b5272901f64211901c62c9fd41a1420fcd91082de60f2edf80e53f4f4b7

升级后 SHA-256：
d15568f21d468730cb208a3c5080da0b956722206d8b7b25dfc88dbf7c4d6092
```

生产 manifest 已同步更新 `controllerSha256`。

## 阶段门禁

```text
phase4bResidualRecoveryPassed=true
productionControllerCleanupUpgraded=true
productionTunRuntimeRecovered=true
phase4bControlledAutoRouteRetestReady=true
phase4cRoutingPolicyIntegrationReady=false
```

Phase 4C 尚未开放。下一步必须使用新版清理契约重跑修正后的 Phase 4B 生命周期收口。
