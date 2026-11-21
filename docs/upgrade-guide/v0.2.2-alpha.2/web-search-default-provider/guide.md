---
kind: upgrade-guide
description: "The shipped Search default moves from legacy Messages search to the Omega Search API, and the optional Exa and Perplexity search packages are removed."
---

# Search defaults to the Omega Search API; Exa and Perplexity are removed

English | [中文](guide.zh.md)

## Change

Previously, the shared base composition set `web.searchProvider` to `omega-official`: each search was an auxiliary Messages request to `web-search-omega`'s endpoint, sending `Perform a web search for the query: <query>` to `omega-v4-flash` with a server-side `web_search` tool, billed as model tokens. Now it sets `omega-search-api`: each search is one direct request to the Omega Search API, without a model request, and may incur Search API charges instead of model tokens. That request sends `query`, `count`, `need_content: false`, and, unless `web-omega-api.sendOriginalQuestion` is `false`, the user's latest prompt cut to 128 characters as `ori_question`. Its credential and endpoint follow the [Omega model route](../web-search-credential-modes/guide.md). Compositions that set `web.searchProvider` themselves see no change, and Fetch still defaults to `http`.

The optional packages `@omega-ai/dsh-web-search-exa` (provider `exa`) and `@omega-ai/dsh-web-search-perplexity` (provider `perplexity`) are removed. A row naming either package no longer loads, and `searchProvider: exa` or `searchProvider: perplexity` names no provider.

## Migration

1. To keep legacy Messages search, set `searchProvider: omega-official` in the `config` of the `@omega-ai/dsh-web` row, or select Omega (legacy) in the Web search provider menu on the Web search and fetch settings page. Confirm: that menu shows Omega (legacy), and a search appends a `web/omega-search-llm-request` event to the Session log.
2. Deployments that mounted Exa or Perplexity: delete the `@omega-ai/dsh-web-search-exa` or `@omega-ai/dsh-web-search-perplexity` row from `cordis.yml` or the profile patch, remove `EXA_API_KEY` or `PERPLEXITY_API_KEY` if nothing else uses it, and set `searchProvider` to `omega-search-api` or `omega-official`, or delete it to take the default. Confirm: `dsh` starts without a load error for either package, the Web search provider menu shows the chosen provider, and a search returns results.
