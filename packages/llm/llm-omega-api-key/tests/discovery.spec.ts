/** The configured model catalog is independent of request credentials. */
import { Context } from '@omega-ai/cordis'
import LlmRuntime from '@omega-ai/dsh-llm'
import { expect, it, vi } from 'vitest'
import * as ApiKey from '../src/index.ts'

it.each(['', 'invalid\nheader'])('advertises configured models without a usable API key: %j', async (key) => {
  vi.stubEnv('OMEGA_API_KEY', key)
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime)
    // The catalog ships empty, so the test supplies the entry it advertises.
    await ctx.plugin(ApiKey, { models: [{ id: 'omega-flash' }] })
    expect(await ctx.llm.listModels('omega-official')).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'omega-official', id: 'omega-flash' }),
    ]))
  } finally {
    await ctx.fiber.dispose()
    vi.unstubAllEnvs()
  }
})
