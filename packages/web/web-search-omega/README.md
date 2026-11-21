---
description: "The Omega-backed search provider for ctx.web: how deployments mount native Omega web search through the Anthropic-compatible Messages API, with per-search credential resolution."
kind: "package-reference"
---

# @omega-ai/dsh-web-search-omega

English | [中文](README.zh.md)

## Summary

With `dsh-web-search-omega`, the harness searches the web through Omega's native search using the Omega account sign-in or an existing `OMEGA_API_KEY`. Choose it when a deployment wants Omega native search and accepts that one search costs a full model turn in latency and tokens; the Omega Search and Fetch APIs in [dsh-web-omega-api](../web-omega-api/README.md) retrieve without one. Results come from Omega's structured search blocks, never from reply text. It is not ready for a model request without a credential, so `dsh-tool-web` withholds `web_search` from that request; a call that still arrives, or a response without a search-result block, fails with a structured error.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the provider in a composition that already loads the web service; it registers as the `omega-official` search provider, so `ctx.web.search()` resolves it automatically when it is the only usable search backend — or pin it with `searchProvider: omega-official`.

### When to choose it

Choose this backend when a deployment wants Omega's native server-side web search and its users either sign in to a Omega account or hold a `OMEGA_API_KEY` — the provider reuses those credentials as [Authentication](#authentication) describes. One search is heavier than a dedicated retrieval endpoint: Omega runs the search inside a full model turn, so expect one Messages call's latency and generated tokens per search, with up to `maxUses` server-side searches per request. Avoid it when per-search cost or latency dominates.

### Minimal configuration

Load the web service and the provider; the key resolves from `ctx.credentials` when that service is mounted, otherwise from the process environment. The auxiliary search call has its own endpoint setting and uses the Anthropic-compatible base `http://127.0.0.1:8090/anthropic/v1`, with `/messages` appended. It reads `$OMEGA_SEARCH_BASE_URL`, independently of the conversation adapter’s `$OMEGA_BASE_URL`.

```yaml
- name: '@omega-ai/dsh-web'
- name: '@omega-ai/dsh-web-search-omega'
  config:
    apiKeyEnv: OMEGA_API_KEY
    baseURL: https://gateway.internal/anthropic/v1
```

| Field | Default | Meaning |
|---|---|---|
| `apiKey` | omitted | Literal Omega API key; prefer `apiKeyEnv` so no secret enters configuration. A non-empty literal wins over `apiKeyEnv`; an account token wins over both |
| `apiKeyEnv` | `OMEGA_API_KEY` | Credential reference resolved for each search through `ctx.credentials`, or from the process environment when that service is absent. A search that needs an API key and finds none fails as `WEB_PROVIDER_CREDENTIAL_MISSING` |
| `baseURL` | `http://127.0.0.1:8090/anthropic/v1` | Anthropic-compatible endpoint base; `/messages` is appended. Falls back to `$OMEGA_SEARCH_BASE_URL`; an unparseable value makes the provider unavailable |
| `model` | `qwen3.8-27b-lite` | Anthropic-format model name |
| `apiVersion` | `2023-06-01` | `anthropic-version` header value |
| `maxTokens` | `4096` | Positive-integer upper bound on generated tokens for the Messages request |
| `maxUses` | `5` | Positive-integer maximum `web_search` server-tool uses per request |

The generated [configuration catalog](../../../docs/config-catalog.md#omega-aidsh-web-search-omega) lists every accepted field. Each search captures options from the live Config references.

<a id="authentication"></a>
### Authentication

A search authenticates with the Omega account when the latest `request/context` event of the initiating Session names the `omega-account` provider route and `ctx.omegaAccount` resolves a token for the search endpoint. The account service resolves one only while signed in and only for its deployment-configured inference origin, `http://127.0.0.1:8090` by default. That search sends only `x-dsh-auth-token`, even when an API key is configured. Every other search, including a call without an initiating Session and a search whose endpoint has another origin, sends the API key as both `x-api-key` and `Authorization: Bearer`. An HTTP 401 response to an account-authenticated search fails as `WEB_PROVIDER_ERROR` with sign-in guidance instead of endpoint guidance, and leaves the account signed in.

### What a search returns

`content` is always omitted: Omega's provider prose is not trusted as an answer. `sources[]` comes from `web_search_result` items inside `web_search_tool_result` blocks — `url` and `title` directly, and `publishedAt` from `page_age` — with snippets joined from URL-keyed `cited_text` entries where an excerpt exists. Results are deduplicated by URL, and because Omega exposes no result-count knob, the service enforces `maxResults` by truncating and flagging.

### Request logging

A search running under an initiating agent appends the log-only `web/omega-search-llm-request` session event immediately before dispatch. It carries the resolved endpoint, API version, and the exact secret-free JSON body sent to Omega; headers and credentials are excluded. Credential failures and cancellations before dispatch create no event, while later HTTP or response failures leave the attempted request durable.

### Failures and recovery

Failures throw `WebError` with a machine-routable code: a missing credential is `WEB_PROVIDER_CREDENTIAL_MISSING`, caller cancellation is `WEB_ABORTED`, and provider or transport failures — including a response with no `web_search_tool_result` block — are `WEB_PROVIDER_ERROR`. HTTP redirects are rejected before the `Location` target is contacted. Every failure after dispatch names the resolved search endpoint and explains that search endpoint configuration is separate from chat. If the endpoint is unintended, the message tells the conversation model to guide the user to Plugins > Built-in plugin settings > Web search and fetch, select Omega server-side search under Search, and save its Base URL. When that page is unavailable, it names `web-search-omega.baseURL` as the deployment configuration alternative. The model must not choose or change the endpoint. The model-facing `web_search` tool surfaces this text under its own error wrapper.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the provider; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The provider is built on two commitments:

- **Structured blocks only.** Omega runs the search server-side and returns structured `web_search_tool_result` blocks; the provider parses those blocks and never scrapes URLs out of model prose. In strict mode, a response with no such block throws `WEB_PROVIDER_ERROR` instead of degrading.
- **Conversation credentials, resolved per search.** The provider adds no secret: a search from a Session on the account route, whose deployment has the search endpoint's origin, uses the account sign-in, and every other search reuses the `OMEGA_API_KEY` reference. The auxiliary request endpoint stays independent through `$OMEGA_SEARCH_BASE_URL`. A mounted credentials service is authoritative; without one the key is read from the launching process environment. Resolving per call means a key stored or rotated in the Web Models page, or an account sign-in, reaches the next search without a restart.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Config schema, per-search option capture, and search readiness |
| [`src/provider.ts`](src/provider.ts) | The `OmegaSearchProvider`: Messages request dispatch, block parsing, citation joining, credential resolution |
| [`src/types.ts`](src/types.ts) | Anthropic wire types for the search response |

### Request flow

Each search captures the current Config values into provider options — endpoint, model, key reference, limits — then asks [`ctx.omegaAuth`](../../account/omega-auth/README.md) for the credential of the search endpoint, the account sign-in in a conversation on the account route and otherwise the referenced key read through `ctx.credentials` (or the environment), appends the log-only session event, and dispatches the Messages request with the native `web_search` server tool. The response's `web_search_tool_result` blocks become `sources[]`, each with its item's own snippet; `cited_text` entries from text blocks are joined by URL as the snippets of items without one; results are deduplicated by URL; and the service enforces the requested source bound on the way back.

Readiness captures the same options but reads no API key value: it asks each candidate `ctx.omegaAuth` returns for the search, in order, whether its credential is configured, in a conversation on the account route first the account sign-in for the search endpoint and then the key reference through `ctx.credentials.describe()` (or the environment). A literal key always counts as configured.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the shared vocabulary to the service, the model-facing tools, and the design rationale.

- [Web subsystem](../../../docs/subsystems/web.md) — the exhaustive search request/result vocabulary and error codes.
- [Web package map](../README.md) — the web package family and each role.
- [dsh-web](../web/README.md) — the web service this provider registers into.
- [dsh-tool-web](../tool-web/README.md) — the model-facing `web_search` tool that renders this provider's sources.
- [Generated configuration catalog](../../../docs/config-catalog.md#omega-aidsh-web-search-omega) — every accepted config field and its source declaration.
- [Web capability seam decision](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — why search and fetch share one provider-selection service.
- [Search readiness decision](../../../.agents/notes/implemented/architecture/2026-09-27-web-search-offered-by-provider-readiness.md) — why this provider reports readiness while `dsh-tool-web` withholds `web_search`.

-----

<a id="model-experience"></a>
## Model Experience

### Auxiliary Omega search request

#### What the model sees

A separate Omega model receives exactly `Perform a web search for the query: <query>` as its user text and one native `web_search` server-tool definition, with thinking disabled. This request is not part of the conversation model's context.

#### Token effect

Separate provider input and output tokens are incurred for each search; disabled thinking adds no reasoning tokens, `maxTokens` caps generated output, and `maxUses` caps native search uses.

#### KV Cache effect

Independent of the conversation request cache. The auxiliary instruction and native tool definition can form a stable prefix, but each changed query or model route prevents reuse from its first difference.

### Conversation tool result, indirectly

#### What the model sees

Through `dsh-tool-web`, the conversation model sees deduplicated URLs, titles, dates, and snippets from structured search blocks; provider prose is not trusted as an answer. This provider's exact failures include the actionable missing-credential message, which also names Omega Account sign-in, `Omega search credential resolution failed: <error>`, and `Omega search aborted`. An HTTP 401 to an account-authenticated search appends an instruction to guide the user to sign in to Omega again. A search the account's sign-out ended reports `The Omega account signed out before this web search finished. Guide the user to sign in to Omega again; the search endpoint does not need changing.` Other request, HTTP, native-search, and response-body failures append the resolved endpoint and the conditional configuration instruction described above. The consumer owns the error wrapper.

#### Token effect

Zero direct conversation tokens from registration. Result tokens scale with returned sources and snippets, then the service enforces the requested source bound.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Conversation tool list, indirectly

#### What the model sees

While this provider is selected, a conversation request for which it is not ready carries neither the `web_search` schema nor its prompt guidance; [`dsh-tool-web`](../tool-web/README.md#search-readiness) owns that effect.

#### Token effect

Withholding removes the `web_search` schema and its prompt guidance from the request.

#### KV Cache effect

A returning or removed `web_search` changes the declared tools as [`dsh-tool-web`](../tool-web/README.md#search-readiness) describes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the provider is expensive or incomplete. They are current package constraints.

- **One search costs a full Messages model turn** — latency plus generated tokens, with up to `maxUses` server-side searches; [dsh-web-omega-api](../web-omega-api/README.md) uses the dedicated Search API instead.
- **Provider selection cannot see a missing key** — the synchronous availability check can establish that a resolver exists but cannot query an asynchronous credential store, so `ctx.web` still selects a keyless provider and a direct search fails with `WEB_PROVIDER_CREDENTIAL_MISSING`; the asynchronous `ready()` affects only which model requests are offered `web_search`.
- **Readiness checks presence, not validity** — a wrong key, or an endpoint without the native `web_search_20250305` server tool, counts as ready, so `web_search` stays offered and each call fails with a structured error.
- **Search does not follow the chat endpoint** — when the official route chats through a gateway, search still sends its key to the configured search endpoint, the official one by default, and fails unless that endpoint accepts the key.
- **Over-returned sources still cost tokens** — with no result-count knob on the wire, `maxResults` is enforced only post-hoc by service truncation.
- **A source's `snippet` depends on the endpoint** — it is the excerpt the endpoint returns with the result item, or else a text-block citation (`cited_text`) matching its URL; an Anthropic-compatible endpoint that returns neither yields sources without snippets.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and undecided directions. It is explicitly non-authoritative — shipped behavior, limits, and rationale live in the sections above and the linked Agent Notes.

#### Dedicated retrieval endpoint

Omega's Search and Fetch APIs, which avoid the full model turn, live in [dsh-web-omega-api](../web-omega-api/README.md) and are selected with the Search and Fetch menus on the Web search and fetch settings page. Shipped profiles fix no search provider, so this provider runs for model requests on the Omega model routes and the Search API runs on other routes; `searchProvider: omega-official` selects this provider for every route (for example, on gateways without Search API routes).

</details>
