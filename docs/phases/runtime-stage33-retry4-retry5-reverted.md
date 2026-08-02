# Runtime 阶段 33：撤销非系统返回手势方案

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 状态：已撤销

## 撤销内容

以下方案与“Android / ColorOS 系统侧滑返回”需求不一致，已从分支删除：

- `src/sbh_38_edge_back_fallback.js`
- `src/sbh_39_bounded_edge_back_handles.js`
- `docs/phases/runtime-stage33-retry4-edge-back-fallback.md`
- `docs/phases/runtime-stage33-retry5-bounded-visible-edge-back.md`

## 撤销原因

上述实现通过透明边缘触摸区或可见把手自行识别横向滑动，本质上属于应用内自定义手势，不是系统返回事件，也不能替代 ColorOS 系统侧滑返回。

## 后续硬边界

1. 不再新增边缘触摸区、返回把手或自定义横向滑动手势。
2. 只修复系统返回事件接收与页面返回链。
3. 以 `7015725/Chiphub` 已通过真机验证的系统侧滑返回实现为参考基线。
4. 必须对比窗口类型、`WindowManager.LayoutParams` flags、焦点策略、回调注册时机、回调对象生命周期和页面返回栈。
5. 未取得 Chiphub 实际源码前，不继续猜测或生成新的返回修复模块。
6. Runtime、Core、TUN、路由和配置安全边界保持不变。
