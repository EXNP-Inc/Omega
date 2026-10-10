/** Account-route quota classification stays separate from API-key and third-party quota. */
import { Context } from '@omega-ai/cordis'
import { BlockAssembler, LlmRuntime } from '@omega-ai/dsh-llm'
import type { OmegaAccount } from '@omega-ai/dsh-omega-account'
import * as ApiKey from '@omega-ai/dsh-llm-omega-api-key'
import { afterEach, expect, it, vi } from 'vitest'
import * as Account from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

/** Drive one streamed request through the runtime and return its terminal failure. */
async function finishOf(ctx: Context, provider: string) {
  const assembler = new BlockAssembler()
  for await (const chunk of ctx.llm.stream({ provider, model: 'omega-flash', messages: [] })) assembler.push(chunk)
  return assembler.finish
}

/** Mount the shared runtime plus the one credential plugin that owns `provider`. */
async function routeFor(token: string | undefined, provider: 'omega-account' | 'omega-official'): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  ctx.provide('omegaAccount', {
    resolveToken: async (_baseURL: string): Promise<string | undefined> => token,
    rejectToken: async (_token: string): Promise<void> => {},
  } as OmegaAccount)
  await ctx.plugin(provider === 'omega-account' ? Account : ApiKey)
  return ctx
}

it.each([
  { provider: 'omega-account', apiKey: '', code: 'ACCOUNT_QUOTA' },
  { provider: 'omega-account', apiKey: 'fixture-api-key', code: 'ACCOUNT_QUOTA' },
  { provider: 'omega-official', apiKey: 'fixture-api-key', code: 'QUOTA' },
] as const)('reports a 402 balance rejection on $provider with apiKey "$apiKey" as $code', async ({ provider, apiKey, code }) => {
  vi.stubEnv('OMEGA_API_KEY', apiKey)
  const ctx = await routeFor('account-token', provider)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    error: { code: 'insufficient_balance', message: 'Insufficient balance' },
  }), { status: 402 }))
  await expect(finishOf(ctx, provider)).resolves.toMatchObject({ kind: 'error', failure: { code } })
})

it('reports an in-band account balance stream error as ACCOUNT_QUOTA', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'fixture-api-key')
  const ctx = await routeFor('account-token', 'omega-account')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
    'event: error\ndata: {"type":"error","error":{"type":"invalid_request_error","code":"insufficient_balance","message":"Insufficient balance"}}\n\n',
    { status: 200 },
  ))
  await expect(finishOf(ctx, 'omega-account')).resolves.toMatchObject({
    kind: 'error', failure: { code: 'ACCOUNT_QUOTA' },
  })
})

it('still expires the stored credential on an account-route 401', async () => {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  const rejectToken = vi.fn(async (_token: string): Promise<void> => {})
  ctx.provide('omegaAccount', {
    resolveToken: async (_baseURL: string): Promise<string | undefined> => 'account-token',
    rejectToken: (token: string): Promise<void> => rejectToken(token),
  } as OmegaAccount)
  await ctx.plugin(Account)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }))
  await expect(finishOf(ctx, 'omega-account')).resolves.toMatchObject({
    kind: 'error', failure: { code: 'ACCOUNT_TOKEN_INVALID' },
  })
  expect(rejectToken.mock.calls).toEqual([['account-token']])
})
