---
kind: upgrade-guide
description: "The shipped composition no longer fixes a search provider, so web search in a conversation on a Omega model runs legacy Messages search instead of the Omega Search API."
---

# Search on Omega models defaults to legacy Messages search

English | [中文](guide.zh.md)

## Change

Previously, the shared base composition set `web.searchProvider` to `omega-search-api`, so every search was one Omega Search API request. Now the base sets no `searchProvider`, and `dsh-web` selects per model provider route. A search made for a model request on the `omega-official` or `omega-account` route runs the `omega-official` search provider: an auxiliary Messages request to `web-search-omega`'s endpoint, which has no per-search charge and is billed as model tokens, and which appends a `web/omega-search-llm-request` event to the Session log. A search on any other route, or outside a model request, still runs `omega-search-api`.

The Messages search endpoint does not follow the model provider's base URL: it is `web-search-omega.baseURL`, else `$OMEGA_SEARCH_BASE_URL`, else `https://api.omega.com/anthropic/v1`, and outside an account conversation it receives the key under `web-search-omega.apiKeyEnv` (`OMEGA_API_KEY` by default). A deployment whose Omega model provider points at a gateway therefore sends that key to the official endpoint and its searches fail until step 2 or 3 is applied.

The Web search provider menu on the Web search and fetch settings page gains **Automatic**, which is the selection when none is stored. A composition or profile that sets `web.searchProvider` itself, and `DSH_WEB_SEARCH_PROVIDER`, see no change. Fetch still defaults to `http`.

## Migration

1. To accept the new default, change nothing. Confirm: the Web search provider menu shows Automatic, and a search in a conversation on a Omega model appends a `web/omega-search-llm-request` event.
2. To keep the Omega Search API for every model, select Omega Search API in that menu and save, or set `searchProvider: omega-search-api` beside `fetchProvider: http` in the `config` of the `@omega-ai/dsh-web` row. Confirm: the menu shows Omega Search API, and a search appends no `web/omega-search-llm-request` event.
3. To use Messages search through a gateway, select Omega server-side search in that menu and save the gateway's Anthropic-compatible base, which ends before `/messages`, as its Base URL, or set `web-search-omega.baseURL`; then select Automatic again if other models should keep the Search API. Confirm: a search on a Omega model returns results, and its `web/omega-search-llm-request` event names the gateway endpoint.
