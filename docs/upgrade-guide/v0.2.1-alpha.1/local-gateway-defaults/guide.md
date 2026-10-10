---
kind: upgrade-guide
description: "All shipped WAN default endpoints now point to the localhost gateway, and the default models are the local alice/mac pi-ai providers."
---

# Local gateway defaults replace WAN endpoints

English | [中文](guide.zh.md)

## Change

Profiles built on the base bundle now default to `provider: mac`, `model: qwen3.8-27b-lite`, routed through the `mac` pi-ai provider that ships in the bundle (127.0.0.1:8002, `MAC_API_KEY`); an `alice` provider (127.0.0.1:8001, `ALICE_API_KEY`, `qwen3.8-27b`) ships alongside. The previous default was `omega-official` / `omega-v4-flash`. The `llm-omega` model catalog ships empty where it previously advertised `omega-flash` and `omega-v4-pro`; every model id still resolves as a generic text-only entry.

The remaining default endpoints moved from WAN hosts to the local gateway `http://127.0.0.1:8090`: `llm-omega` `baseURL` (`/anthropic`), `web-search-omega` `baseURL` (`/anthropic/v1`, default model `qwen3.8-27b-lite`), product and session telemetry OTLP endpoints (`/v1/logs`), `omega-account-platform` `platformOrigin` and `inferenceOrigin`, the account contact form (`/contact`), and the desktop production update feed. `omega-account-platform` `allowLoopbackHttp` now defaults to `true`. SDK defaults in `@omega-ai/dsh-sdk` client/server and `@omega-ai/dsh-subagent-dsh-sdk` are `mac` / `qwen3.8-27b-lite`. llm-omega real-API e2e requires both `$OMEGA_API_KEY` and `$OMEGA_BASE_URL`.

No auto-initiated request leaves the machine unless you configure an endpoint; explicit row, settings, or environment values keep precedence over every new default.

## Migration

1. Start the local model endpoints at 127.0.0.1:8001/v1 and 127.0.0.1:8002/v1 (OpenAI-responses compatible) and export `ALICE_API_KEY` / `MAC_API_KEY`. Confirm with a `dsh` run that the first turn reaches `qwen3.8-27b-lite`.
2. For deployments that must reach a real gateway, restate the endpoint on each shipped row: `llm-omega` `baseURL`, `web-search-omega` `baseURL`, `omega-account-platform` `platformOrigin` / `inferenceOrigin` (and `allowLoopbackHttp: false` for non-loopback hosts), the telemetry `url` (or `$DSH_TELEMETRY_OTLP_URL` / `$DSH_PRODUCT_ANALYTICS_OTLP_URL`), the `contactFormUrl` settings key, and the desktop production origin in `desktop-auto-update-environment`.
3. Confirm no unconfigured surface still expects a WAN default: `ctx.llm.listModels('omega-official')` returns `[]` unless a catalog is configured, and a boot with no configuration opens no connection outside loopback.
