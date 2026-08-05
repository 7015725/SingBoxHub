# Runtime Stage 53 真机结果：Shell 引号多转义导致前置门禁误判

## 结论

Stage 53 未进入 Runtime `START` 请求。失败发生在首个只读前置 Shell 门禁：

```text
ok=false
preflightPassed=false
blockingGate="\"root_uid\""
preflightCode=null
errorCode=CORE_LIFECYCLE_INTEGRATION_FAILED
error=Error: "\"root_uid\""
```

本次没有启动或停止 sing-box Core，也没有修改生产配置、staging、TUN、路由、DNS 或防火墙。

## 真机安全状态

- `startCommandSent=false`
- `startRequestCount=0`
- `coreStartInvoked=false`
- `corePid=null`
- `stopCommandSent=false`
- `coreStopInvoked=false`
- `finalPingSent=false`
- `rollbackInvoked=false`
- `runtimeFilesModified=false`
- `configModified=false`
- `stagingModified=false`
- `tunCreated=false`
- `routeModified=false`
- `dnsModified=false`
- `firewallModified=false`
- `networkConnectivityTestInvoked=false`
- `networkTrafficGeneratedByProbe=false`
- `destructiveOperations=false`

## 根因

Stage 53 模块中的 Shell 片段被额外转义了一层。模块源码里的字符串实际形态为：

```javascript
"[ \\\"$UIDV\\\" = 0 ] || fail root_uid 701"
"fail(){ GATE=\\\"$1\\\"; CODE=\\\"$2\\\"; finish; }"
```

JavaScript 求值后，发送给 Shell 的内容包含反斜杠转义的字面引号：

```sh
[ \"$UIDV\" = 0 ]
GATE=\"$1\"
```

Shell 因此将引号作为普通字符保留：

- uid `0` 被比较成带字面引号的 `"0"`，导致 `root_uid` 门禁误失败；
- `GATE` 被赋值为带字面引号的 `"root_uid"`；
- JSON 中最终显示为 `"\"root_uid\""`。

该结果不是 root 权限丢失。前一阶段已经以相同 ShortX Shell 通道完成 root 所有权、endpoint 和控制服务身份验证；异常字段自身也证明了 Shell 字符串构造错误。

## ShortX 传输值

- `preflightShellCode=158`
- `shellCodeAuthoritative=false`
- `shellTransportCodeAnomalous=true`

本次根因与传输层 `158` 无关。Shell 已输出可解析门禁字段，但门禁字符串本身被错误转义。

## 修复方向

Stage 53 Retry 1：

1. 将 Shell 字符串中的三重反斜杠引号修正为标准 JavaScript `\"`；
2. 将 `tr` 参数中的四重反斜杠修正为标准双反斜杠；
3. 显式返回 `shellUid`；
4. 对前置、START 后观察、STOP 后观察、回滚和审计 5 组生成 Shell 执行 `sh -n`；
5. 在隔离环境执行前置脚本，确认 uid `0` 可以越过 `root_uid`，下一失败门禁为不存在的测试 Runtime 根目录；
6. 使用新的单次授权重新执行同一受限生命周期闭环。
