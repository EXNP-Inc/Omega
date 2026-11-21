---
kind: upgrade-guide
description: "Omega model routes and web providers require the new dsh-omega-auth plugin; the llm-omega credential helpers, the dsh-llm API key check, the route plugins' config exports, and account Agent inspection are removed."
---

# Omega consumers authenticate through ctx.omegaAuth

English | [中文](guide.zh.md)

## Change

`@omega-ai/dsh-omega-auth` provides `ctx.omegaAuth`, which releases the API key or the account sign-in for one Omega request. `@omega-ai/dsh-llm-omega-api-key`, `@omega-ai/dsh-llm-omega-account`, `@omega-ai/dsh-web-omega-api`, and `@omega-ai/dsh-web-search-omega` declare it as a peer dependency and start only in a composition that mounts it. The `base` and `sdk-minimal` bundles mount it.

`@omega-ai/dsh-llm-omega` no longer exports `resolveOmegaApiKey`, `omegaApiKeyConfigured`, `resolveOmegaAccountToken`, or `rejectOmegaAccountToken`. `OmegaAdapterOptions.resolveAuth(connection, endpoint)` returns `OmegaRequestAuth | undefined`, `OmegaRequestAuth` gains an optional `revoked` signal, and the new `missingCredential` option names the missing-credential failure. `createModelListingCache` takes `credential(url)` returning request headers, and its `load` is optional.

`@omega-ai/dsh-llm` no longer exports `normalizeApiKey` and `assertUsableApiKey`. `@omega-ai/dsh-credentials` exports `normalizeApiKey(raw)`, `resolveCredentialRef(ctx, ref)`, and `credentialRefConfigured(ctx, ref)`.

`@omega-ai/dsh-llm-omega-api-key` no longer exports `plainOptions` and `resolveAdapterOptions`; `@omega-ai/dsh-llm-omega-account` no longer exports `plainAccountOptions` and `resolveAccountOptions`. The account route plugin cancels its running Agents after sign-out and registers a running-task report.

`@omega-ai/dsh-omega-account` adds Host-only `resolveRequestCredential(url)` and `registerRunningTaskReport(report)` and makes `resolveToken(url)` and `rejectToken(token)` private; `hasRunningAccountTasks()` answers from registered reports and no longer reads `ctx.agents`. A sign-out aborts released credentials' `revoked` signal, ending in-flight account requests: model requests outside a turn fail with `ACCOUNT_SIGN_IN_REQUIRED`, Search and Fetch with `WEB_PROVIDER_ERROR`. The package drops its `dsh-agent` and `dsh-llm` peer dependencies and moves from `packages/credentials/` to `packages/account/` under its unchanged name.

Without the account route, the Search and Fetch APIs send the account credential to the origin `OMEGA_BASE_URL` names and reject a value that is not an HTTP(S) URL without embedded credentials. With `auto` billing, a `omega-account` or `omega-official` conversation whose route plugin is not mounted tries the API key, then the account credential. `OmegaSearchProviderOptions` replaces `resolveAccountToken`, `rejectAccountToken`, and `resolveApiKey` with `authorize(endpoint, signal)`.

## Migration

1. Add `- name: '@omega-ai/dsh-omega-auth'` to every composition that mounts one of the four plugins without the `base` or `sdk-minimal` bundle. Code that mounts them through `ctx.plugin()` mounts the package's default export first.
2. Replace the removed `llm-omega` helpers with `ctx.omegaAuth.authorize({ consumer, accepts, destination })`: send the returned `headers`, call `reject()` after HTTP 401 when present, and end the request when `revoked` aborts. `candidates()` answers presence checks.
3. Replace `assertUsableApiKey` with `normalizeApiKey` from `@omega-ai/dsh-credentials`, and throw your own error for its `reason`.
4. In custom `OmegaAdapter` or `registerOmegaProvider` consumers, return `undefined` from `resolveAuth` when no credential exists and supply `missingCredential` for a route-specific failure. Pass credential headers, not a token, to `createModelListingCache`.
5. Replace imports of the route plugins' config exports with the plugins' own `Config`.
6. Make `omegaAccount` stand-ins implement `resolveRequestCredential`, returning a `revoked` signal; stand-ins that supplied `ctx.agents` for `hasRunningAccountTasks()` register a report instead.
7. Update workspace references to `packages/account/omega-account`; the npm package name, Remote namespace, and configuration keys are unchanged.
8. Replace `resolveAccountToken`, `rejectAccountToken`, and `resolveApiKey` in `OmegaSearchProviderOptions` with `authorize`.
9. Type-check the callers, then send one Omega model request and one web search in each changed composition.
