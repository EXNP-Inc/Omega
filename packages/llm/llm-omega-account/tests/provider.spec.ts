/** Account and API-key plugins own independent route registrations and catalogs. */
import { Context } from '@omega-ai/cordis'
import LlmRuntime from '@omega-ai/dsh-llm'
import type { OmegaAccount } from '@omega-ai/dsh-omega-account'
import * as ApiKey from '@omega-ai/dsh-llm-omega-api-key'
import { afterEach, expect, it, vi } from 'vitest'
import * as Account from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  vi.unstubAllEnvs()
})

it('keeps discovery and disposal independent across the two credential routes', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'fixture-api-key')
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  let token: string | undefined = 'fixture-account-token'
  ctx.provide('omegaAccount', { resolveToken: async (_baseURL: string): Promise<string | undefined> => token } as OmegaAccount)
  const account = ctx.plugin(Account, { models: [{ id: 'account-model', name: 'Account model' }] })
  await account
  expect(ctx.llm.listProviders().map(row => row.id)).toEqual(['omega-account'])
  const official = ctx.plugin(ApiKey, { models: [{ id: 'api-key-model', name: 'API-key model' }] })
  await official
  expect((await ctx.llm.listModels('omega-account')).map(row => row.id)).toEqual(['account-model'])
  expect((await ctx.llm.listModels('omega-official')).map(row => row.id)).toEqual(['api-key-model'])
  expect(ctx.llm.listConfigurableProviders().map(row => [row.provider, row.settingsNs])).toEqual([
    ['omega-account', 'llm-omega-account'], ['omega-official', 'llm-omega-api-key'],
  ])
  expect(Account.Config({})).not.toHaveProperty('apiKeyEnv')
  token = undefined
  expect(await ctx.llm.listModels('omega-account')).toEqual([])
  expect(await ctx.llm.listModels('omega-official')).toHaveLength(1)
  token = 'new-account-token'
  expect(await ctx.llm.listModels('omega-account')).toHaveLength(1)
  await account.dispose()
  expect(ctx.llm.listProviders().map(row => row.id)).toEqual(['omega-official'])
  expect(ctx.llm.listConfigurableProviders().map(row => row.provider)).toEqual(['omega-official'])
  await official.dispose()
  expect(ctx.llm.listProviders()).toEqual([])
  expect(ctx.llm.listConfigurableProviders()).toEqual([])
})
