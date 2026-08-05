# ADR-0001：直接启动 Runtime 控制服务，不调用生产 `ensure`

- 日期：2026-08-02
- 状态：已采用，真机验证待完成
- 分支：`agent/runtime-client-readonly-20260802`

## 背景

第 27 阶段重试 3 确认 `control_endpoint.json` 已过期，其中记录的 PID 不存在。继续验证真实 PING，必须先生成一个由存活 Runtime 控制服务持有的新 endpoint。

生产控制器 `bin/singboxhub-runtime ensure` 除启动控制服务外，还包含孤儿核心进程和 TUN/路由残留清理。用户本阶段只授权启动控制服务和执行一次只读 PING，没有授权停止核心、清理 TUN、修改路由或配置。

## 决策

第 28 阶段不调用生产 `ensure`，只复用其已经验证的底层启动协议：

```text
CLASSPATH=<Runtime JAR>
app_process64|app_process /system/bin
com.singboxhub.runtime.CoreRuntimeMain
<socketName> <token> <sing-box binary> <config> <working directory> <ready file>
```

执行前必须确认：

1. sing-box 核心进程不存在；
2. 相同 Runtime 配置和工作目录对应的控制服务不存在；
3. Runtime JAR、sing-box 二进制、配置、工作目录和控制目录均存在；
4. 只替换已确认无存活控制服务对应的旧 endpoint。

控制服务启动后，原子写入 `mode=600` 的新 endpoint，校验进程身份和文件所有者，再发送一次固定命令 `PING`。

## 写入范围

本阶段仅允许：

```text
runtime/control/control_endpoint.json
runtime/control/runtime.*.ready
runtime/control/runtime.*.pid
logs/runtime-production.log
```

临时 ready、pid 和 endpoint 文件在成功或启动失败回滚后清理。

## 禁止范围

```text
不启动 sing-box 核心
不调用 START、STOP_CORE、STOP_RUNTIME
不创建 TUN
不修改路由、DNS、防火墙或配置
不调用 CoreClientMain.main()
不自动进行第二次连接或请求
```

## 故障处理

- ready 文件超时或 endpoint 写入失败：只终止本次新建的控制服务并清理本次临时文件。
- endpoint 校验或 PING 在控制服务成功启动后失败：保留控制服务和 endpoint，避免未经授权自动停止进程；后续处理需要新的明确授权。
- 无论成功或失败，一次性授权都会被消费。

## 结果

该决策把授权范围限制在控制平面启动和一个只读请求内，避免生产 `ensure` 的额外清理副作用。真机结果由 `docs/phases/runtime-stage28-control-service-bootstrap-ping.md` 记录。