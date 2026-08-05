# Runtime 阶段 33 重试 3：本地验证缓存加内嵌返回修复

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 下载文件：`SingBoxHub_本地缓存内联返回修复阶段33重试3.txt`
- 下载文件 SHA-256：`30e22db9d8b131b34926aee233b253ff3786fa4a34b5bc0d46328c9ff85cf812`
- 入口版本：`41`
- 基础本地模块集：`20260803.08`
- 测试模块集标识：`20260803.08+back37-inline`
- 本地模块数：`21`
- 内嵌模块：`sbh_37_back_dispatch_repair.js`
- 内嵌模块 SHA-256：`aaeffc7b219de58e5697041fc185c5835105208227257942faa18349764e673a`
- 状态：实现完成，真机待验证

## 1. 目的

绕过通用入口中会隐藏原始同步错误的远端 manifest 和 active/lastGood 回退链，只验证 ColorOS 返回分发修复本身。

## 2. 启动方式

```text
定位 SingBoxHubClient/modules/sets/20260803.08
    ↓
逐一读取 21 个本地模块
    ↓
使用入口内嵌哈希表校验每个模块 SHA-256
    ↓
按原顺序加载 21 个已验证模块
    ↓
校验并加载内嵌 sbh_37_back_dispatch_repair.js
    ↓
调用 SBH.app.start()
```

该入口不读取 `module-manifest.json`，也不读取 `active.json` 或 `last_good.json` 来决定模块版本。

## 3. 网络和写入边界

```json
{
  "remoteManifestUsed": false,
  "networkAccessed": false,
  "downloadedCount": 0,
  "localBaseModuleSetVersion": "20260803.08",
  "localBaseModuleCount": 21,
  "inlineModuleVerified": true
}
```

模块加载入口本身不修改模块集、manifest、active 或 lastGood 指针。应用正常运行时仍会按已有 UI 行为更新自身状态文件。

Runtime 安全边界保持：

- 只读认证 PING；
- 写操作继续锁定；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由或配置。

## 4. 精确错误

如果本地缓存不完整，返回：

```text
VERIFIED_BASE_SET_MISSING
LOCAL_MODULE_MISSING: <module>
LOCAL_MODULE_SHA256_MISMATCH: <module>
INLINE_MODULE_SHA256_MISMATCH
```

不再返回无法区分远端失败和本地回退失败的通用 `Invalid module manifest`。

## 5. 真机门禁

启动 JSON 至少满足：

```text
ok=true
entryVersion=41
bootstrapMode=verified_local_cache_plus_inline_module
remoteManifestUsed=false
networkAccessed=false
localBaseModuleSetVersion=20260803.08
localBaseModuleCount=21
localBaseModulesVerified=true
inlineModuleVerified=true
app.systemBackRepairRegistered=true
app.systemBackRepairRegistrationError=null
```

随后测试：

1. 二级页面系统侧滑返回首页；
2. 首页系统侧滑关闭浮窗；
3. 浮窗内握手、门禁、刷新反馈保持正常；
4. 页面切换和右上角关闭按钮无回归。
