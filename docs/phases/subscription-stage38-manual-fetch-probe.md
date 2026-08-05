# Subscription Stage 38：手动单次抓取与格式探测

- 日期：2026-08-03
- 分支：`agent/runtime-client-readonly-20260802`
- 入口版本：`51`
- 模块集：`20260803.12`
- 模块数：`24`
- 固定提交：`26e81297e43016c12fe699851732aa55aa0354eb`
- 状态：待真机验证

## 新增模块

- `src/sbh_45_subscription_fetch_probe.js`
  - SHA-256：`042ef28b0234705770748b5d70439b5d20eb6830df5e6b9996632cb8e52ff45a`
- `src/sbh_44_subscription_crud_ui.js` version 2
  - SHA-256：`fc69fdf5df832667e01ebc3632e5aa01f2bd08d82e10729ae1e54d1999412203`

## 行为

只有用户点击订阅卡片的“抓取探测”按钮时才访问网络。每次点击最多执行一次请求事务，不自动刷新、不轮询、不自动重试。

抓取完成后仅返回脱敏元数据：

- 最终来源的 scheme、host、path 和被遮蔽的 query 状态；
- HTTP 状态、重定向次数、Content-Type、字节数和响应 SHA-256；
- 格式类型；
- 候选节点数量和协议计数。

支持探测：

- sing-box JSON；
- Clash YAML；
- 明文 URI 列表；
- Base64 URI 列表；
- 未知文本。

## 网络和安全边界

- connect timeout：12 秒；
- read timeout：20 秒；
- 最大重定向：3 次；
- 最大响应体：4 MiB；
- 禁止 URL user-info；
- 禁止 HTTPS 降级到 HTTP；
- 禁止 localhost、私网、链路本地、组播地址；
- 原始响应不返回、不记录、不持久化；
- 不写 Runtime 配置；
- 不启动 Core/TUN；
- 不修改路由；
- 系统返回继续延期，不添加自定义手势。

## 真机门禁

1. `entryVersion=51`。
2. `moduleSetVersion=20260803.12`。
3. `moduleSetActivated=true`，无 fallback 和 warning。
4. `subscriptionFetchProbeReady=true`。
5. `subscriptionFetchButtonReady=true`。
6. 未点击“抓取探测”前不发生订阅网络请求。
7. 点击后返回脱敏结果或脱敏错误，浮窗保持可操作。
8. Runtime/Core/TUN/路由安全字段保持未修改。
