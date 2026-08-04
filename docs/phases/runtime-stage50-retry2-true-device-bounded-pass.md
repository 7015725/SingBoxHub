# Runtime Stage 50 Retry 2 真机结果：`Runtime/state` 修复完成（有界证据）

## 结论

Stage 50 Retry 2 的真机界面显示：

```text
Runtime state 目录修复完成
```

该提示仅在模块回调收到 `result.ok === true` 时显示。因此可以确认本次目录修复逻辑返回成功。

附件中的入口启动结果同时确认：

- `entryVersion=70`
- `stage=production_stage50_retry2_state_directory_repair`
- 本地基础模块集 `20260803.22` 校验通过；
- 内联模块 `sbh_70_runtime_state_directory_repair.js` SHA-256 校验通过；
- 未使用远程 manifest，未下载模块；
- Runtime 认证只读状态正常；
- `coreRunning=false`
- `coreStartInvoked=false`
- `tunCreated=false`
- `routeModified=false`
- `configModified=false`
- `networkAccessed=false`

## 成功提示的代码约束

`sbh_70_runtime_state_directory_repair.js` 只有在下列 `success` 条件全部满足时才设置 `result.ok=true`：

- Shell 完成标记存在；
- `repairResult=repaired`；
- `Runtime/state` 为普通目录；
- mode 为 `0700`；
- uid/gid 为 `0/0`；
- 生产配置哈希与字节数在修复前后保持不变；
- staging 哈希与字节数在修复前后保持不变；
- 精确匹配 Core 数量为 0；
- `sbh-tun0` 不存在；
- IPv4/IPv6 规则 `8800–8815` 数量为 0；
- IPv4/IPv6 路由表 `20240` 数量为 0。

UI 回调仅在 `result.ok === true` 时显示“Runtime state 目录修复完成”。

## 证据边界

本次上传的文本附件是入口启动 JSON，不是按钮回调返回的完整修复 JSON；截图也未显示完整结果对象。因此以下字段没有逐项保存其真机原值：

- `repairResult`
- `stateDirectoryMode`
- `stateDirectoryUid`
- `stateDirectoryGid`
- 配置与 staging 前后哈希
- 修复前后 Core、TUN、规则和路由计数

本阶段结论属于**代码约束下的有界通过**，不能替代完整 JSON 归档。

## 后续安全补偿

Stage 50 Retry 3 在启动 Core 前必须独立复核：

1. `Runtime/state` 为普通目录且非符号链接；
2. mode 为 `0700`；
3. uid/gid 为 `0/0`；
4. 生产配置与唯一 staging 的哈希和字节数一致；
5. `sing-box check` 通过；
6. 不存在活动 PID、活动元数据或已有匹配 Core；
7. `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空。

只有上述门禁全部通过才允许派发 Core。

## 运行边界

本次目录修复没有启动或停止 Core，没有修改生产配置或 staging，没有创建 TUN，没有修改路由、DNS 或防火墙，也没有访问外部网络。
