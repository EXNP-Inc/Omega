import { describe, expect, it } from 'vitest'
import {
  OmegaSearchProvider,
  OMEGA_DEFAULT_API_VERSION,
  OMEGA_DEFAULT_BASE_URL,
  OMEGA_DEFAULT_MAX_TOKENS,
  OMEGA_DEFAULT_MAX_USES,
  OMEGA_DEFAULT_MODEL,
} from '@omega-ai/dsh-web-search-omega'

/** Construct the provider over a fixed options value; production passes a live thunk. */
import type { OmegaSearchProviderOptions } from '@omega-ai/dsh-web-search-omega'

const searchProvider = (options: OmegaSearchProviderOptions): OmegaSearchProvider =>
  new OmegaSearchProvider(() => options)

/**
 * Disabled real-API probe for the Omega search provider. The live endpoint
 * can complete without structured source blocks, so this is not a reliable
 * merge signal. Its body remains because mocks cannot confirm the wire shape.
 */
const apiKey = process.env.OMEGA_API_KEY
const maybe = apiKey !== undefined && apiKey.length > 0 ? describe : describe.skip

maybe('OmegaSearchProvider real API', () => {
  it.skip('returns citeable sources for a live query via native web_search', async () => {
    const provider = searchProvider({
      apiKey: apiKey!,
      baseURL: process.env.OMEGA_SEARCH_BASE_URL ?? OMEGA_DEFAULT_BASE_URL,
      model: process.env.OMEGA_SEARCH_MODEL ?? OMEGA_DEFAULT_MODEL,
      apiVersion: OMEGA_DEFAULT_API_VERSION,
      maxTokens: OMEGA_DEFAULT_MAX_TOKENS,
      maxUses: OMEGA_DEFAULT_MAX_USES,
    })
    const result = await provider.search({ query: 'What is Omega?', maxResults: 5 })
    expect(result.sources.length).toBeGreaterThan(0)
    for (const source of result.sources) expect(source.url).toMatch(/^https?:\/\//)
  }, 60_000)
})
