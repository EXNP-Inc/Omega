/** Model discovery requires the API-key route's own credential. */
import { Context } from '@omega-ai/cordis'
import LlmRuntime from '@omega-ai/dsh-llm'
import { expect, it, vi } from 'vitest'
import * as ApiKey from '../src/index.ts'
import OmegaAuth from '@omega-ai/dsh-omega-auth'

it.each([undefined, ''])('hides models without an API key: %j', async (key) => {
  vi.stubEnv('OMEGA_API_KEY', key)
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(OmegaAuth)
    await ctx.plugin(ApiKey, {})
    expect(await ctx.llm.listModels('omega-official')).toEqual([])
  } finally {
    await ctx.fiber.dispose()
    vi.unstubAllEnvs()
  }
})

it('advertises configured models with an API key', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'fixture-api-key')
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(OmegaAuth)
    await ctx.plugin(ApiKey, { models: [{ id: 'configured-model' }] })
    expect(await ctx.llm.listModels('omega-official')).toEqual([
      expect.objectContaining({ provider: 'omega-official', id: 'configured-model' }),
    ])
  } finally {
    await ctx.fiber.dispose()
    vi.unstubAllEnvs()
  }
})

it('reports malformed credentials during discovery under the settings namespace the provider directory lists', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'invalid\nheader')
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(OmegaAuth)
    await ctx.plugin(ApiKey, {})
    const [directory] = ctx.llm.listConfigurableProviders()
    expect(directory?.settingsNs).toBe('llm-omega-api-key')
    const failure = ctx.llm.listModels('omega-official')
    await expect(failure).rejects.toMatchObject({ code: 'INVALID_CREDENTIAL' })
    await expect(failure).rejects.toThrow('llm-omega-api-key: the API key resolved from OMEGA_API_KEY contains characters')
  } finally {
    await ctx.fiber.dispose()
    vi.unstubAllEnvs()
  }
})

it('names the Loader entry id in credential diagnostics, as product profiles mount the route', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'invalid\nheader')
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(OmegaAuth)
    await ctx.plugin({
      name: ApiKey.name, inject: ApiKey.inject, Config: ApiKey.Config,
      apply: (inner: Context, config: ApiKey.Config) => {
        // The Loader attaches the entry before a plugin applies; product profiles use the id `llm-omega`.
        Object.defineProperty(inner.fiber, 'entry', { value: { options: { id: 'llm-omega' } } })
        ApiKey.apply(inner, config)
      },
    }, {})
    expect(ctx.llm.listConfigurableProviders().map(entry => entry.settingsNs)).toEqual(['llm-omega'])
    await expect(ctx.llm.listModels('omega-official')).rejects.toThrow(
      'llm-omega: the API key resolved from OMEGA_API_KEY contains characters no HTTP header can carry',
    )
  } finally {
    await ctx.fiber.dispose()
    vi.unstubAllEnvs()
  }
})

it('connects its route id, key reference and deployment, so other Omega consumers send its key to its origin', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'default-key')
  vi.stubEnv('ROUTE_KEY', 'fixture-api-key')
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(OmegaAuth)
    const search = { consumer: 'web-test', accepts: ['api-key'], billing: 'api-key', destination: { path: '/v1/tools/search' } } as const
    const route = await ctx.plugin(ApiKey, { baseURL: 'https://route.omega.test/anthropic', apiKeyEnv: 'ROUTE_KEY' })
    expect(ctx.omegaAuth.routeKind('omega-official')).toBe('api-key')
    expect(await ctx.omegaAuth.authorize(search)).toEqual({
      kind: 'api-key', endpoint: 'https://route.omega.test/v1/tools/search', reference: 'ROUTE_KEY', headers: { authorization: 'Bearer fixture-api-key' },
    })
    vi.stubEnv('ROUTE_KEY', 'invalid\nheader')
    await expect(ctx.omegaAuth.authorize(search)).rejects.toThrow('llm-omega-api-key: the API key resolved from ROUTE_KEY contains characters')
    await route.dispose()
    expect(ctx.omegaAuth.routeKind('omega-official')).toBeUndefined()
    expect(await ctx.omegaAuth.authorize(search)).toMatchObject({ endpoint: 'https://api.omega.com/v1/tools/search', reference: 'OMEGA_API_KEY' })
  } finally {
    await ctx.fiber.dispose()
    vi.unstubAllEnvs()
  }
})

it('fails a model listing whose credential store cannot be read with the store\'s failure', async () => {
  const failure = new Error('credential store unreadable')
  const ctx = new Context()
  try {
    ctx.provide('credentials', { resolve: () => Promise.reject(failure) } as never)
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(OmegaAuth)
    await ctx.plugin(ApiKey, { models: [{ id: 'configured-model' }] })
    await expect(ctx.llm.listModels('omega-official')).rejects.toBe(failure)
  } finally {
    await ctx.fiber.dispose()
  }
})
