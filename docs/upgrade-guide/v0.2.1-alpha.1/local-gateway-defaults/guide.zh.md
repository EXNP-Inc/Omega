---
kind: upgrade-guide
description: "所有内置的 WAN 默认端点现指向 localhost 网关，默认模型改为本地 alice/mac pi-ai 提供商。"
---

# 本地网关默认值取代 WAN 端点

[English](guide.md) | 中文

## 变更

基于 base bundle 构建的 profile 现在默认使用 `provider: mac`、`model: qwen3.8-27b-lite`，经由 bundle 内置的 `mac` pi-ai 提供商路由（127.0.0.1:8002，`MAC_API_KEY`）；同时内置 `alice` 提供商（127.0.0.1:8001，`ALICE_API_KEY`，`qwen3.8-27b`）。此前的默认值是 `omega-official` / `omega-v4-flash`。`llm-omega` 的模型目录现在为空发布，不再像之前那样公布 `omega-flash` 和 `omega-v4-pro`；任何模型 id 仍按通用的纯文本条目解析。

其余默认端点从 WAN 主机迁移到本地网关 `http://127.0.0.1:8090`：`llm-omega` 的 `baseURL`（`/anthropic`）、`web-search-omega` 的 `baseURL`（`/anthropic/v1`，默认模型 `qwen3.8-27b-lite`）、产品与会话遥测的 OTLP 端点（`/v1/logs`）、`omega-account-platform` 的 `platformOrigin` 和 `inferenceOrigin`、账户联系表单（`/contact`）、桌面版生产更新源。`omega-account-platform` 的 `allowLoopbackHttp` 现在默认为 `true`。`@omega-ai/dsh-sdk` client/server 与 `@omega-ai/dsh-subagent-dsh-sdk` 中的 SDK 默认值为 `mac` / `qwen3.8-27b-lite`。llm-omega 真实 API e2e 需要同时设置 `$OMEGA_API_KEY` 和 `$OMEGA_BASE_URL`。

除非你配置了端点，否则没有任何自动发起的请求离开本机；显式的行、设置或环境变量值始终优先于所有新默认值。

## 迁移

1. 在 127.0.0.1:8001/v1 和 127.0.0.1:8002/v1 启动本地模型端点（OpenAI-responses 兼容），并导出 `ALICE_API_KEY` / `MAC_API_KEY`。通过一次 `dsh` 运行确认第一轮请求到达 `qwen3.8-27b-lite`。
2. 对于必须连接真实网关的部署，在每个内置行上重新声明端点：`llm-omega` 的 `baseURL`、`web-search-omega` 的 `baseURL`、`omega-account-platform` 的 `platformOrigin` / `inferenceOrigin`（非回环主机另加 `allowLoopbackHttp: false`）、遥测 `url`（或 `$DSH_TELEMETRY_OTLP_URL` / `$DSH_PRODUCT_ANALYTICS_OTLP_URL`）、`contactFormUrl` 设置键、`desktop-auto-update-environment` 中的桌面生产源。
3. 确认没有未配置的界面仍期待 WAN 默认值：未配置目录时 `ctx.llm.listModels('omega-official')` 返回 `[]`，且无配置启动不会在回环之外打开任何连接。
