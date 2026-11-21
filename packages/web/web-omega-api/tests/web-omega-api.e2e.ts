import { describe, expect, it } from 'vitest'
import { OmegaFetchApiProvider, OmegaSearchApiProvider } from '@omega-ai/dsh-web-omega-api'
import { customGuidance } from './guidance.ts'
import { keyCandidate } from './sources.ts'

/** Real Search and Fetch API probes; the base names the deployment the key authenticates. */
const apiKey = process.env.OMEGA_API_KEY
const baseURL = process.env.OMEGA_SEARCH_API_TEST_BASE_URL ?? ''
const auth = (path: '/search' | '/fetch') => ({ sources: [keyCandidate(`${baseURL}${path}`, apiKey ?? '', 'OMEGA_API_KEY')] })
const maybe = apiKey !== undefined && apiKey.length > 0 && baseURL.length > 0 ? describe : describe.skip

maybe('Omega Search and Fetch real API', () => {
  it('returns citeable sources from the Search API', async () => {
    const provider = new OmegaSearchApiProvider(() => ({ auth: auth('/search'), count: 10, requestsPerSecond: 5, guidance: customGuidance('search') }))
    const result = await provider.search({ query: 'Omega', maxResults: 3 }, AbortSignal.timeout(30_000))
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources.length).toBeLessThanOrEqual(3)
    for (const source of result.sources) expect(source.url).toMatch(/^https?:\/\//)
  }, 40_000)

  it('returns Markdown from the Fetch API', async () => {
    const provider = new OmegaFetchApiProvider(() => ({ auth: auth('/fetch'), guidance: customGuidance('fetch') }))
    const result = await provider.fetch({ url: 'https://example.com' }, AbortSignal.timeout(30_000))
    expect(result.body.kind).toBe('text')
    expect(result.body.content.length).toBeGreaterThan(0)
    expect(result.statusCode).toBe(200)
  }, 40_000)
})
