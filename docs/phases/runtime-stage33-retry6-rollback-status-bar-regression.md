# Runtime 阶段 33 重试 6：回退状态栏覆盖回归

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 隔离入口版本：`46`
- 测试模块集：`20260803.08+cliphub40-layout-rollback`
- 状态：待真机确认布局恢复

## 1. 输入结果

Retry 5 真机验证确认：

- 节点页、设置页和首页的系统侧滑返回仍未生效；
- 浮窗顶部进入系统状态栏区域；
- 系统状态栏图标覆盖 SingBoxHub 标题区域；
- 回归由 `sbh_41_cliphub_modal_focus_parity.js` 引入。

## 2. 回退内容

已从分支删除：

```text
src/sbh_41_cliphub_modal_focus_parity.js
```

Retry 6 恢复 Retry 4 的窗口布局基线：

- 不再清除 `FLAG_NOT_TOUCH_MODAL`；
- 不再对 attached 窗口强制执行 modal flags 更新；
- 不再执行 Retry 5 的延迟窗口焦点重请求；
- 保留 `sbh_40_cliphub_system_back_port.js` 作为系统返回诊断链；
- 不包含边缘触摸区、自定义滑动或返回把手。

## 3. 预期结果

1. 浮窗顶部重新避开系统状态栏；
2. 标题栏、关闭按钮和只读状态标签恢复原位置；
3. Runtime 认证、页面显示和浮窗内反馈保持正常；
4. 系统返回仍标记为未解决，不作为本次回退验收项。

## 4. 安全边界

- 不读取远端 manifest；
- 使用设备中已经验签通过的 `20260803.08` 本地模块集；
- 不启动或停止 Core；
- 不创建 TUN；
- 不修改路由、配置或 Runtime 文件。

## 5. 后续

状态栏布局恢复后，暂停继续修改窗口 flags。下一轮系统返回分析必须基于 ClipHub 真机运行时的实际窗口参数与 Window Focus 证据，而不是继续猜测静态 flags。
