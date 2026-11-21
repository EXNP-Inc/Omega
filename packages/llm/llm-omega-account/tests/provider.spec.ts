/** The account route serves its /models listing, gates models, and keeps discovery independent of the API-key route. */
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@omega-ai/cordis'
import { brandString } from '@omega-ai/dsh-brand'
import LlmRuntime, { type ReasoningEffortId } from '@omega-ai/dsh-llm'
import { accountStub } from '../../../account/omega-account/tests/account-stub.ts'
import * as ApiKey from '@omega-ai/dsh-llm-omega-api-key'
import * as Account from '../src/index.ts'
import OmegaAuth from '@omega-ai/dsh-omega-auth'

const requires = (version: string) => ({ client_requirements: { 'omega-harness': { min_version: version } } })
const MESSAGES = { output_modalities: ['text'], api_capabilities: { anthropic_messages: {} } }
const FLASH = {
  id: 'omega-flash', name: 'Omega-V4.1-Flash', context_window: 1_048_576, max_output_tokens: 393_216,
  input_modalities: ['text', 'image'], output_modalities: ['text'],
  effort: { supported_levels: ['low', 'high', 'max'], default_level: 'high' },
  api_capabilities: { anthropic_messages: { system_prompt_update: 'in-history', tool_update: 'addition-only' } },
  ...requires('0.1.0'),
}
const PRO = { id: 'omega-v4-pro', name: 'Omega-V4-Pro', context_window: 1_048_576, max_output_tokens: 393_216, input_modalities: ['text'], ...MESSAGES }

const contexts: Context[] = []
const servers: Server[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/** Loopback listing endpoint: `reply` answers GET /models; any other request fails the test through its status. */
async function listing(reply: (request: IncomingMessage, response: ServerResponse) => void) {
  const requests: IncomingMessage[] = []
  const server = createServer((request, response) => {
    requests.push(request)
    if (request.method === 'GET' && request.url === '/models') reply(request, response)
    else response.writeHead(500).end('unexpected request')
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  const origin = `http://127.0.0.1:${address.port}`
  return { origin, requests, baseURL: `${origin}/anthropic` }
}
const json = (body: unknown) => (_request: IncomingMessage, response: ServerResponse) => {
  response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body))
}

async function host(origin: string, token: () => string | undefined = () => 'fixture-account-token') {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  ctx.provide('omegaAccount', accountStub({ token: url => new URL(url).origin === origin ? token() : undefined }))
  return ctx
}

it('keeps discovery and disposal independent across the two credential routes', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'fixture-api-key')
  const server = await listing(json({ data: [FLASH, { ...PRO, ...requires('0.1.0') }] }))
  let token: string | undefined = 'fixture-account-token'
  const ctx = await host(server.origin, () => token)
  await ctx.plugin(OmegaAuth)
  const account = ctx.plugin(Account, { baseURL: server.baseURL })
  await account
  const official = ctx.plugin(ApiKey, { models: [{ id: 'api-key-model', name: 'API-key model' }] })
  await official
  expect((await ctx.llm.listModels('omega-account')).map(row => [row.id, row.name])).toEqual([
    ['omega-flash', 'Omega-V4.1-Flash'], ['omega-v4-pro', 'Omega-V4-Pro'],
  ])
  expect((await ctx.llm.listModels('omega-official')).map(row => row.id)).toEqual(['api-key-model'])
  expect(ctx.llm.listConfigurableProviders().map(row => [row.provider, row.settingsNs])).toEqual([
    ['omega-account', 'llm-omega-account'], ['omega-official', 'llm-omega-api-key'],
  ])
  expect(Account.Config({})).not.toHaveProperty('apiKeyEnv')
  token = undefined
  expect(await ctx.llm.listModels('omega-account')).toEqual([])
  token = 'second-account-token'
  expect(await ctx.llm.listModels('omega-account')).toHaveLength(2)
  expect(server.requests.map(request => request.headers['x-dsh-auth-token'])).toEqual(['fixture-account-token', 'second-account-token'])
  await account.dispose()
  expect(ctx.llm.listProviders().map(row => row.id)).toEqual(['omega-official'])
  await official.dispose()
  expect(ctx.llm.listConfigurableProviders()).toEqual([])
})

it('resolves listed capabilities with this build\'s model knowledge', async () => {
  const server = await listing(json({ data: [FLASH, { ...PRO, ...requires('0.1.0') }] }))
  const ctx = await host(server.origin)
  await ctx.plugin(OmegaAuth)
  await ctx.plugin(Account, { baseURL: server.baseURL })
  await expect(ctx.llm.resolveModelInfo('omega-account', 'omega-flash')).resolves.toMatchObject({
    name: 'Omega-V4.1-Flash', context: { contextWindow: 1_048_576 }, defaultMaxTokens: 256_000,
    systemPromptUpdate: 'in-history', toolUpdate: 'addition-only', inputModalities: ['text', 'image'],
    reasoning: { defaultEffort: brandString<ReasoningEffortId>('high') },
  })
  await expect(ctx.llm.resolveModelInfo('omega-account', 'omega-v4-pro')).resolves.not.toHaveProperty('systemPromptUpdate')
  expect(server.requests).toHaveLength(1)
  expect(server.requests[0]?.headers['user-agent']).toMatch(/^omega-harness\//)
})

it('advertises the badges its listing declares', async () => {
  const badge = { text: { en: 'New', zh: '新' }, tone: 'success' }
  const server = await listing(json({ data: [{ ...FLASH, client_metadata: { 'omega-harness': { badge } } }, { ...PRO, ...requires('0.1.0') }] }))
  const ctx = await host(server.origin)
  await ctx.plugin(OmegaAuth)
  await ctx.plugin(Account, { baseURL: server.baseURL })
  expect((await ctx.llm.listModels('omega-account')).map(row => [row.id, row.badge])).toEqual([
    ['omega-flash', badge], ['omega-v4-pro', undefined],
  ])
})

it('publishes an account badge removal after the default idle refresh interval', async () => {
  let badge: { text: string } | undefined = { text: 'New' }
  const server = await listing((request, response) => {
    json({ data: [{ ...FLASH, client_metadata: { 'omega-harness': { badge } } }] })(request, response)
  })
  const ctx = await host(server.origin)
  const refreshed = Promise.withResolvers<undefined>()
  const changes: string[] = []
  ctx.on('llm/models-updated', (provider) => {
    changes.push(provider)
    if (changes.length === 2) refreshed.resolve(undefined)
  })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  try {
    await ctx.plugin(OmegaAuth)
    await ctx.plugin(Account, { baseURL: server.baseURL })
    expect((await ctx.llm.listModels('omega-account'))[0]?.badge?.text).toBe('New')
    badge = undefined
    await vi.advanceTimersByTimeAsync(600_000)
    await refreshed.promise
    expect(changes).toEqual(['omega-account', 'omega-account'])
    expect((await ctx.llm.listModels('omega-account'))[0]).not.toHaveProperty('badge')
    expect(server.requests).toHaveLength(2)
  } finally {
    try { await ctx.fiber.dispose() }
    finally { vi.useRealTimers() }
  }
})

it('falls back to the bundled catalog when the listing fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const server = await listing((_request, response) => { response.writeHead(503).end('down') })
  const ctx = await host(server.origin)
  await ctx.plugin(OmegaAuth)
  await ctx.plugin(Account, { baseURL: server.baseURL })
  expect(await ctx.llm.listModels('omega-account')).toEqual([])
  expect(warn).toHaveBeenCalledExactlyOnceWith('[llm-omega-account]', expect.stringContaining('using the bundled catalog') as string)
  await expect(ctx.llm.resolveModelInfo('omega-account', 'omega-flash')).resolves.toMatchObject({ context: { contextWindow: 1_000_000 } })
})

it('hides and refuses listed models this build cannot serve before any inference request', async () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const server = await listing(json({ data: [
    FLASH,
    { ...PRO, id: 'omega-v5' },
    { ...PRO, id: 'omega-v5-open', ...requires('0.0.1') },
    { ...PRO, id: 'omega-v5-next', ...requires('99.0.0-alpha.1') },
    { id: 'omega-v4-pro', ...requires('0.0.1') },
  ] }))
  const ctx = await host(server.origin)
  await ctx.plugin(OmegaAuth)
  await ctx.plugin(Account, { baseURL: server.baseURL })
  expect((await ctx.llm.listModels('omega-account')).map(row => row.id)).toEqual(['omega-flash', 'omega-v5-open'])
  await expect(ctx.llm.prepareCall({ provider: 'omega-account', model: 'omega-v5' })).rejects.toMatchObject({ code: 'MODEL_UNSUPPORTED' })
  await expect(ctx.llm.prepareCall({ provider: 'omega-account', model: 'omega-v4-pro' })).rejects.toMatchObject({ code: 'MODEL_UNSUPPORTED' })
  await expect(ctx.llm.prepareCall({ provider: 'omega-account', model: 'omega-v5-next' }))
    .rejects.toMatchObject({ code: 'CLIENT_UPGRADE_REQUIRED', message: expect.stringMatching(/requires Omega 99\.0\.0-alpha\.1 or later; current version is /) as string })
  await expect(ctx.llm.prepareCall({ provider: 'omega-account', model: 'unlisted-pass-through' })).resolves.toBeDefined()
  expect(server.requests.map(request => request.url)).toEqual(['/models'])
  expect(diagnostic).toHaveBeenCalledExactlyOnceWith('[llm-omega-account]', expect.stringContaining('loaded 5 model(s), skipped 0 row(s)') as string)
  expect(warn).toHaveBeenCalledExactlyOnceWith('[llm-omega-account]', 'model "omega-v4-pro" declares no api_capabilities.anthropic_messages')
})

it('applies model overrides and reports stale ones on the provider directory until they resolve', async () => {
  let token = 'first-account'
  const server = await listing((request, response) => {
    const rows = request.headers['x-dsh-auth-token'] === 'first-account' ? [FLASH] : [FLASH, { ...PRO, id: 'omega-v5', ...requires('0.0.1') }]
    json({ data: rows })(request, response)
  })
  const ctx = await host(server.origin, () => token)
  await ctx.plugin(OmegaAuth)
  await ctx.plugin(Account, { baseURL: server.baseURL, modelOverrides: { 'omega-flash': { contextWindow: 524_288 }, 'omega-v5': { contextWindow: 9 } } })
  await ctx.llm.listModels('omega-account')
  await expect(ctx.llm.resolveModelInfo('omega-account', 'omega-flash')).resolves.toMatchObject({ context: { contextWindow: 524_288 } })
  expect(ctx.llm.listConfigurableProviders()[0]?.error).toContain('"omega-v5"')
  await ctx.llm.listModels('omega-account')
  expect(ctx.llm.listConfigurableProviders()[0]?.error).toContain('"omega-v5"')
  token = 'second-account'
  await ctx.llm.listModels('omega-account')
  expect(ctx.llm.listConfigurableProviders()[0]).not.toHaveProperty('error')
  await expect(ctx.llm.resolveModelInfo('omega-account', 'omega-v5')).resolves.toMatchObject({ context: { contextWindow: 9 } })
})

it('rejects the retired models setting at load', async () => {
  const ctx = await host('http://127.0.0.1:1')
  await ctx.plugin(OmegaAuth)
  await expect(ctx.plugin(Account, { models: [] })).rejects.toThrow(/models is no longer configurable/)
  expect(ctx.llm.listProviders()).toEqual([])
})

it('aborts an in-flight listing request when the plugin is disposed', async () => {
  const held = Promise.withResolvers<IncomingMessage>()
  const server = await listing((request) => { held.resolve(request) })
  const ctx = await host(server.origin)
  await ctx.plugin(OmegaAuth)
  const account = ctx.plugin(Account, { baseURL: server.baseURL })
  await account
  const pending = ctx.llm.listModels('omega-account')
  const request = await held.promise
  const closed = new Promise(resolve => request.socket.once('close', resolve))
  await account.dispose()
  await closed
  await expect(pending).resolves.toEqual(expect.any(Array))
})

it('connects its route id and deployment, so other Omega consumers send the account sign-in to its origin', async () => {
  const asked: string[] = []
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  ctx.provide('omegaAccount', accountStub({ token: (url) => { asked.push(url); return 'fixture-account-token' } }))
  await ctx.plugin(OmegaAuth)
  const search = { consumer: 'web-test', accepts: ['account'], billing: 'account', destination: { path: '/v1/tools/search' } } as const
  const route = await ctx.plugin(Account, { baseURL: 'https://account.omega.test/anthropic' })
  expect(ctx.omegaAuth.routeKind('omega-account')).toBe('account')
  expect(await ctx.omegaAuth.authorize(search)).toMatchObject({
    kind: 'account', endpoint: 'https://account.omega.test/v1/tools/search', headers: { 'x-dsh-auth-token': 'fixture-account-token' },
  })
  await route.dispose()
  expect(ctx.omegaAuth.routeKind('omega-account')).toBeUndefined()
  expect(await ctx.omegaAuth.authorize(search)).toMatchObject({ endpoint: 'https://api.omega.com/v1/tools/search' })
  expect(asked).toEqual(['https://account.omega.test/v1/tools/search', 'https://api.omega.com/v1/tools/search'])
})
