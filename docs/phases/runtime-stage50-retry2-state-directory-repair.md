# Runtime Stage 50 Retry 2：精确修复 `Runtime/state` 目录

## 授权

Stage 50 Retry 1 真机诊断已明确返回：

- `blockingGate=state_directory`
- `likelyOriginalExitCode=214`
- `stateDirectoryValid=false`
- `nextAuthorizedOperation=repair_identified_stage50_preflight_gate`

本阶段仅授权修复该目录门禁：

- 授权 ID：`stage50-retry2-state-directory-repair-user-authorized-20260804`
- 自动重试：禁用
- Core 启动/停止：禁用
- 配置与 staging 修改：禁用
- TUN、路由、DNS、防火墙：禁用

## 实现

新增模块：

- `src/sbh_70_runtime_state_directory_repair.js`
- 模块内部版本：`runtimeStateDirectoryRepair=1`
- 模块 SHA-256：`b949b79a251c014f290dc5ef63682eacd95b0aef9b4a0c774664e081e952f7ba`
- 测试入口版本：70

操作顺序：

1. 验证 root Shell、Runtime 根目录、`config`、`logs`、生产配置和 sing-box 二进制；
2. 记录生产配置与唯一 staging 的 SHA-256 和字节数，并要求二者一致；
3. 确认精确匹配 Core 数量为 0；
4. 确认 `sbh-tun0`、规则 `8800–8815` 和路由表 `20240` 均为空；
5. 检查 `Runtime/state`：
   - 路径不存在：使用 `mkdir` 创建；
   - 已为普通目录且非符号链接：保留并归一化元数据；
   - 普通文件、符号链接或其他冲突：安全拒绝，不删除、不覆盖；
6. 将目录权限设置为 `0700`，uid/gid 设置为 `0/0`；
7. 再次校验生产配置和 staging 未变化；
8. 再次确认 Core、TUN、规则与路由状态未变化。

## 写入范围

唯一允许的写入目标：

```text
<ShortXDir>/SingBoxHub/state
```

仅允许创建目录或归一化该目录本身的权限和所有权，不创建活动 PID、活动元数据或探测子目录。

## 安全边界

- 不执行 Core 派发；
- 不停止任何进程；
- 不修改 `config/runtime-tun.json`；
- 不修改或删除 staging；
- 不创建 `sbh-tun0`；
- 不修改规则 `8800–8815`；
- 不修改路由表 `20240`；
- 不访问外部网络；
- 不使用宽泛 `pkill`、`killall` 或模糊进程匹配。

## 预期通过结果

```text
ok=true
repairResult=repaired
blockingGate=null
stateDirectoryValid=true
stateDirectoryMode=700
stateDirectoryUid=0
stateDirectoryGid=0
productionConfigHashUnchanged=true
productionConfigSizeUnchanged=true
stagingHashUnchanged=true
stagingSizeUnchanged=true
matchingCoreCountBefore=0
matchingCoreCountAfter=0
tunInterfaceBefore=false
tunInterfaceAfter=false
readyForCorrectedStage50Retry=true
nextAuthorizedOperation=runtime_core_start_probe_retry_after_state_directory_repair
```

## 静态与隔离验证

- Rhino ES5/JavaScript 语法检查：通过；
- 生成 Shell 的 `sh -n`：通过；
- 隔离文件系统夹具：成功创建 `0700`、root 所有的 state 目录；
- 生产配置与 staging 哈希、字节数在修复前后保持一致；
- Core、TUN、规则和路由计数保持为 0。

## 当前状态

- 实现完成；
- GitHub 模块与文档已记录；
- 真机验证待执行；
- 本阶段通过后，才生成带新授权的修正版 Stage 50 Core 启动探测。
