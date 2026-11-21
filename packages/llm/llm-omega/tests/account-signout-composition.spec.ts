/**
 * Real Loader composition of the account service, the account route, and the Agent loop against a loopback Omega
 * stand-in: a sign-out ends the requests that carry its token, whether or not their route is still mounted.
 */
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import * as NativeToolExecutor from '@omega-ai/dsh-tool-executor-native'
import { Context } from '@omega-ai/cordis'
import Include from '@omega-ai/cordis-plugin-include'
import Loader from '@omega-ai/cordis-plugin-loader'
import AgentRegistry from '@omega-ai/dsh-agent'
import AgentLoop from '@omega-ai/dsh-agent-loop'
import AuthorizationService from '@omega-ai/dsh-authorization'
import { brandString } from '@omega-ai/dsh-brand'
import { credentialKey } from '@omega-ai/dsh-credentials'
import LocalCredentials from '@omega-ai/dsh-credentials-local'
import OmegaAccount, { type AccountClientMetadata } from '@omega-ai/dsh-omega-account'
import LlmRuntime, { type StreamChunk } from '@omega-ai/dsh-llm'
import * as AccountRoute from '@omega-ai/dsh-llm-omega-account'
import OmegaAuth from '@omega-ai/dsh-omega-auth'
import SessionStore, { type SessionId } from '@omega-ai/dsh-session'
import SessionProjectionRegistry from '@omega-ai/dsh-session-projection'
import SystemPrompt from '@omega-ai/dsh-system-prompt'
import ToolRuntime from '@omega-ai/dsh-tools'
import { profileComposition } from '../../../settings/settings/tests/profile-composition.ts'
import { sourceModuleLoader, sse, start, user } from './helpers.ts'

const PROVIDER = 'omega-account'
const MODEL = 'omega-flash'
const CLIENT: AccountClientMetadata = { version: '1.2.3', locale: 'en', timezoneOffsetSeconds: 28_800 }
const SIGNED_OUT = { kind: 'aborted', reason: { kind: 'hook', reason: 'omega-account/signed-out' } }

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!()
  vi.unstubAllEnvs()
})

/** One open Messages response of the stand-in. */
interface OpenResponse {
  /** Text deltas written so far. */
  deltas: number
  /** Settles when the client closes the response. */
  closed: Promise<undefined>
}

/** Loopback Omega stand-in: the account listing, the logout call, and Messages responses that stream until closed. */
async function upstream() {
  const responses: OpenResponse[] = []
  const http = createServer((request, response) => {
    request.resume()
    request.once('end', () => {
      if (request.method === 'GET' && request.url === '/models') {
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ data: [{
          id: MODEL, name: 'Omega-V4.1-Flash', context_window: 1_048_576, max_output_tokens: 100_000,
          input_modalities: ['text'], output_modalities: ['text'], api_capabilities: { anthropic_messages: {} },
          // This build ships an empty built-in catalog, so the listed model admits only via a satisfied client requirement.
          client_requirements: { 'omega-harness': { min_version: '0.0.1' } },
        }] }))
        return
      }
      if (request.url === '/auth-api/v0/users/logout') {
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ code: 0, data: { biz_code: 0, biz_data: null } }))
        return
      }
      if (request.url !== '/anthropic/v1/messages') { response.writeHead(404).end('{}'); return }
      const closed = Promise.withResolvers<undefined>()
      const open: OpenResponse = { deltas: 0, closed: closed.promise }
      responses.push(open)
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write(sse([start, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }]))
      const timer = setInterval(() => {
        response.write(sse([{ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'x' } }]))
        open.deltas += 1
      }, 10)
      response.once('close', () => { clearInterval(timer); closed.resolve(undefined) })
    })
  })
  http.listen(0, '127.0.0.1')
  await once(http, 'listening')
  const address = http.address()
  if (address === null || typeof address === 'string') throw new Error('missing loopback port')
  cleanup.push(async () => {
    http.closeAllConnections()
    await new Promise<void>((resolve) => { http.close(() => { resolve() }) })
  })
  /** The first Messages response once it has streamed `count` more deltas. */
  const streaming = async (count: number): Promise<OpenResponse> => {
    const from = responses[0]?.deltas ?? 0
    await vi.waitFor(() => { expect(responses[0]?.deltas).toBeGreaterThanOrEqual(from + count) }, { timeout: 10_000, interval: 5 })
    return responses[0]!
  }
  return { origin: `http://127.0.0.1:${String(address.port)}`, streaming }
}

/** Boot the profile through the Loader with a signed-in account whose inference origin is the stand-in. */
async function boot(origin: string) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-account-signout-'))
  cleanup.push(() => rm(home, { recursive: true, force: true }))
  vi.stubEnv('DSH_HOME', home)
  vi.stubEnv('OMEGA_BASE_URL', '')
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  const modules = new Map<string, { module: unknown; config?: object }>([
    ['@omega-ai/dsh-llm', { module: LlmRuntime }], ['@omega-ai/dsh-session', { module: SessionStore }],
    ['@omega-ai/dsh-session-projection', { module: SessionProjectionRegistry }], ['@omega-ai/dsh-system-prompt', { module: SystemPrompt }],
    ['@omega-ai/dsh-tools', { module: ToolRuntime }], ['@omega-ai/dsh-tool-executor-native', { module: NativeToolExecutor }],
    ['@omega-ai/dsh-agent', { module: AgentRegistry }], ['@omega-ai/dsh-agent-loop', { module: AgentLoop, config: { agents: [] } }],
    ['@omega-ai/dsh-credentials-local', { module: LocalCredentials, config: { path: join(home, '.credentials.yaml'), watch: false } }],
    ['@omega-ai/dsh-authorization', { module: AuthorizationService }],
    ['@omega-ai/dsh-omega-account', { module: OmegaAccount, config: {
      platformOrigin: origin, inferenceOrigin: origin, allowLoopbackHttp: true, logoutRetryDelayMs: 1,
    } }],
    ['@omega-ai/dsh-omega-auth', { module: OmegaAuth }],
    ['@omega-ai/dsh-llm-omega-account', { module: AccountRoute, config: { baseURL: `${origin}/anthropic` } }],
  ])
  await writeFile(join(home, 'cordis.yml'), JSON.stringify(
    [...modules].map(([name, { config }]) => ({ name, ...config === undefined ? {} : { config } })),
  ))
  // The importer supplies source modules while Loader still owns configuration and effects.
  for (const name of modules.keys()) {
    const directory = join(home, 'node_modules', name)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name, version: '0.1.3-alpha.1', type: 'module' }))
  }
  ctx.baseUrl = pathToFileURL(home).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  ctx.loader.internal = sourceModuleLoader(async (name) => {
    const found = modules.get(name)
    if (found === undefined) throw new Error(`unexpected module ${name}`)
    return found.module
  })
  const patchPath = await profileComposition(ctx, home, join(home, 'cordis.yml'))
  await ctx.credentials.modifyRecord(credentialKey('omega-account-platform', 'default'), () => Promise.resolve({
    kind: 'grant', payload: { version: 1, issuer: origin, token: 'test-platform-grant' },
  }))
  /** Switch the account route off through the profile patch, as the plugin switch does. */
  const disableRoute = async (): Promise<void> => {
    await writeFile(patchPath, '- id: llm-omega-account\n  disabled: true\n')
    await ctx.hmr.runExclusive(() => ctx.hmr.reconcileProfile())
  }
  return { ctx, disableRoute }
}

const routeListed = (ctx: Context): boolean => ctx.llm.listProviders().some(provider => provider.id === PROVIDER)

it.each([
  { route: 'mounted', disable: false },
  { route: 'disabled', disable: true },
])('ends a streaming account turn at sign-out with the signed-out cause while its route is $route', async ({ disable }) => {
  const http = await upstream()
  const { ctx, disableRoute } = await boot(http.origin)
  const agent = await ctx.agentLoop.create(brandString<SessionId>(`signout-${String(disable)}`), { provider: PROVIDER, model: MODEL })
  agent.followup(user())
  await http.streaming(2)
  if (disable) {
    // Disabling returns while the turn runs, and neither stops the turn nor closes its response.
    await disableRoute()
    expect(routeListed(ctx)).toBe(false)
    await http.streaming(2)
    expect(agent.status).toBe('running')
  }
  const response = await http.streaming(0)
  await ctx.omegaAccount.signOut(CLIENT)
  await agent.whenIdle()
  await response.closed
  const end = agent.session.snapshotEvents().at(-1)
  expect({ type: end?.type, reason: (end?.data as { reason?: unknown }).reason }).toEqual({ type: 'turn/end', reason: SIGNED_OUT })
})

it('ends an account model request outside an Agent turn at sign-out, as a sign-in failure', async () => {
  const http = await upstream()
  const { ctx } = await boot(http.origin)
  const chunks: StreamChunk[] = []
  const consumed = (async () => {
    for await (const chunk of ctx.llm.stream({ provider: PROVIDER, model: MODEL, messages: [user()] })) chunks.push(chunk)
  })()
  const response = await http.streaming(2)
  await ctx.omegaAccount.signOut(CLIENT)
  await consumed
  await response.closed
  expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
    code: 'ACCOUNT_SIGN_IN_REQUIRED',
    message: 'The Omega account signed out before this request finished. Sign in to Omega to use the account provider.',
  } } })
})
