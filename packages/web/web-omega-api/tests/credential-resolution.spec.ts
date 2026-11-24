/**
 * Endpoint and credential of the Search and Fetch APIs: each capability's billing chooses its Omega credential, by
 * default following the conversation, unless it has its own base URL or key reference, and readiness answers what the
 * operation would send.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@omega-ai/cordis'
import AgentRegistry from '@omega-ai/dsh-agent'
import type { Agent } from '@omega-ai/dsh-agent'
import type { OmegaAccount } from '@omega-ai/dsh-omega-account'
import OmegaAuth from '@omega-ai/dsh-omega-auth'
import { accountStub } from '../../../account/omega-account/tests/account-stub.ts'
import { DSH_LAUNCH_ENVIRONMENT_KEY, createLaunchEnvironmentSnapshot } from '@omega-ai/dsh-launch-environment'
import SessionStore, { type SessionId } from '@omega-ai/dsh-session'
import SessionProjectionRegistry from '@omega-ai/dsh-session-projection'
import WebRuntime from '@omega-ai/dsh-web'
import * as webApiPlugin from '@omega-ai/dsh-web-omega-api'
import { provideRoutes, type RouteRow } from './routes.ts'
import { brandString } from '@omega-ai/dsh-brand'

type Operation = 'search' | 'fetch'

const OPERATIONS: readonly Operation[] = ['search', 'fetch']
const OFFICIAL = 'https://api.omega.com/v1/tools'
const ROUTE = 'https://route.omega.test/v1/tools'
const ACCOUNT = 'https://account.omega.test/v1/tools'
const OWN = 'https://own.omega.test/api/v1/tools'

const mounted: Context[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(mounted.splice(0).map(ctx => ctx.fiber.dispose()))
})

interface Setup {
  /** web-omega-api config. */
  config?: Record<string, unknown>
  /** Launch-environment variables. */
  environment?: Record<string, string>
  /** Model routes connected to the authentication service. */
  routes?: readonly RouteRow[]
  /** Account service stand-in. */
  account?: OmegaAccount
  /** Credentials service stand-in. */
  credentials?: object
  /** API response status. */
  status?: number
}

/** One dispatched request: endpoint and credential headers. */
interface Sent {
  endpoint: string
  authorization: string | null
  token: string | null
}

/**
 * Mount both APIs with stubbed endpoints.
 * @param setup - config, routes, and credential planes.
 * @returns the context and the requests sent so far.
 */
async function mount(setup: Setup): Promise<{ ctx: Context; sent: () => Sent[] }> {
  const fetchMock = vi.fn(async (endpoint: string, _init?: RequestInit) => new Response(
    JSON.stringify(setup.status === undefined ? endpoint.endsWith('/search') ? { results: [] } : { content: '# Page' } : {}),
    { status: setup.status ?? 200, headers: { 'content-type': 'application/json' } },
  ))
  vi.stubGlobal('fetch', fetchMock)
  const ctx = new Context()
  mounted.push(ctx)
  ctx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, createLaunchEnvironmentSnapshot([{ source: 'process', values: setup.environment ?? {} }]))
  if (setup.account !== undefined) ctx.provide('omegaAccount', setup.account)
  if (setup.credentials !== undefined) ctx.provide('credentials', setup.credentials as never)
  await ctx.plugin(OmegaAuth)
  if (setup.routes !== undefined) provideRoutes(ctx, setup.routes)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(WebRuntime, { searchProvider: 'omega-search-api', fetchProvider: 'omega-fetch-api' })
  await ctx.plugin(webApiPlugin, setup.config ?? {})
  return {
    ctx,
    sent: () => fetchMock.mock.calls.map(([endpoint, init]) => {
      const headers = new Headers(init?.headers)
      return { endpoint, authorization: headers.get('authorization'), token: headers.get('x-dsh-auth-token') }
    }),
  }
}

let sessions = 0

/**
 * Run one operation, inside a Session whose latest model request used `route` when one is given.
 * @param ctx - the mounted context.
 * @param operation - search or fetch.
 * @param route - provider route of the initiating Session's latest model request; undefined runs outside a Session.
 * @returns the settled operation.
 */
async function operate(ctx: Context, operation: Operation, route?: string): Promise<unknown> {
  const run = () => operation === 'search' ? ctx.web.search({ query: 'q' }) : ctx.web.fetch({ url: 'https://example.test/' })
  if (route === undefined) return await run()
  const session = ctx.sessions.create(brandString<SessionId>(`web-api-${String(sessions++)}`))
  session.append('turn/start', { turn: 1 })
  session.append('request/context', { provider: route, model: 'test-model' })
  return await ctx.agents.withInitiator({ session } as Agent, run)
}

/** Ask whether one operation is ready for a model request on `route`. */
function ready(ctx: Context, operation: Operation, route: string | undefined): Promise<boolean> {
  return operation === 'search' ? ctx.web.searchReady(route) : ctx.web.fetchReady(route)
}

/** The account service of a signed-in user, recording the URLs it is asked for and the tokens it is told to reject. */
function signedIn(asked: string[] = [], reject?: (token: string) => Promise<void>): OmegaAccount {
  return accountStub({ token: (url) => { asked.push(url); return 'account-token' }, ...reject === undefined ? {} : { reject } })
}
/** The account service of a signed-out user. */
const signedOut = (): OmegaAccount => accountStub({ token: () => undefined })
/** An account service whose stored grant cannot be read. */
const unreadable = (): OmegaAccount => accountStub({ token: () => Promise.reject(new Error('grant unreadable')) })

const officialRoute = (config: Record<string, unknown> = { baseURL: 'https://route.omega.test/anthropic' }): RouteRow =>
  ({ provider: 'omega-official', config })
const accountRoute = (config: Record<string, unknown> = { baseURL: 'https://account.omega.test/anthropic' }): RouteRow =>
  ({ provider: 'omega-account', config })
const bothRoutes = [officialRoute(), accountRoute()]

describe.each(OPERATIONS)('%s in a conversation on the Omega account route', (operation) => {
  it('sends only the account token to the account route origin, asking for that endpoint', async () => {
    const asked: string[] = []
    const { ctx, sent } = await mount({ routes: bothRoutes, account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(ctx, operation, 'omega-account')).toBe(true)
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `${ACCOUNT}/${operation}`, authorization: null, token: 'account-token' }])
    expect(asked).toEqual([`${ACCOUNT}/${operation}`, `${ACCOUNT}/${operation}`])
  })

  it('derives the account endpoint from OMEGA_BASE_URL', async () => {
    const { ctx, sent } = await mount({
      routes: [accountRoute({})], account: signedIn(), environment: { OMEGA_BASE_URL: 'https://internal.omega.test/anthropic' },
    })
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `https://internal.omega.test/v1/tools/${operation}`, authorization: null, token: 'account-token' }])
  })

  it('invalidates the token the API rejects with 401', async () => {
    const rejectToken = vi.fn(async (_token: string) => {})
    const { ctx } = await mount({ routes: bothRoutes, account: signedIn([], rejectToken), status: 401 })
    const failure = operate(ctx, operation, 'omega-account')
    await expect(failure).rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    await expect(failure).rejects.toThrow('HTTP 401')
    expect(rejectToken).toHaveBeenCalledExactlyOnceWith('account-token')
  })

  it.each<[string, Setup['account']]>([
    ['the user is not signed in', signedOut()],
    ['no account service is mounted', undefined],
  ])('sends the API key to the API-key endpoint when %s', async (_label, account) => {
    const { ctx, sent } = await mount({
      routes: bothRoutes, ...account === undefined ? {} : { account }, environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(true)
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `${ROUTE}/${operation}`, authorization: 'Bearer chat-key', token: null }])
  })

  it('is not ready and names both recoveries when neither a sign-in nor the key is available', async () => {
    const subject = operation === 'search' ? 'Search' : 'Fetch'
    const { ctx, sent } = await mount({ routes: bothRoutes, account: signedOut() })
    expect(await ready(ctx, operation, 'omega-account')).toBe(false)
    await expect(operate(ctx, operation, 'omega-account')).rejects.toMatchObject({
      code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
      message: `Omega ${subject} API uses the Omega account sign-in of this conversation, then the Omega API key,`
        + ' and neither is available: no signed-in Omega account is available, and no key is configured for'
        + ' "OMEGA_API_KEY". Guide the user to sign in to Omega, or to add the Omega API key on the Models page or'
        + ' export "OMEGA_API_KEY" in the launching environment.',
    })
    expect(sent()).toEqual([])
  })

  it('sends the API key without asking the account when the account route is not mounted', async () => {
    const asked: string[] = []
    const { ctx, sent } = await mount({ routes: [officialRoute()], account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(ctx, operation, 'omega-account')).toBe(true)
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `${ROUTE}/${operation}`, authorization: 'Bearer chat-key', token: null }])
    expect(asked).toEqual([])
  })

  it('is not ready and fails without a token or key when the mounted account route settings do not resolve', async () => {
    const subject = operation === 'search' ? 'Search' : 'Fetch'
    const asked: string[] = []
    const { ctx, sent } = await mount({
      routes: [officialRoute(), accountRoute({ thinking: 'disabled', reasoningEffort: 'high' })],
      account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(false)
    await expect(operate(ctx, operation, 'omega-account')).rejects.toMatchObject({
      code: 'WEB_PROVIDER_MISCONFIGURED',
      message: `Omega ${subject} API sends the Omega account sign-in to the origin of the Omega account model`
        + ' provider, and that provider\'s settings do not resolve: llm-omega: only reasoningEffort "off" can be configured'
        + ` when thinking is disabled. ${subject} did not send the request. Guide the user to correct that provider's settings`
        + ' on the Models page or in the deployment configuration, or to set'
        + ` web-omega-api.${operation}BaseURL and web-omega-api.${operation}ApiKeyEnv so ${subject} uses its own endpoint.`,
    })
    expect(sent()).toEqual([])
    expect(asked).toEqual([])
  })

  it('sends the account token while the mounted API-key route settings do not resolve', async () => {
    const { ctx, sent } = await mount({
      routes: [officialRoute({ thinking: 'disabled', reasoningEffort: 'high' }), accountRoute()],
      account: signedIn(), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(true)
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `${ACCOUNT}/${operation}`, authorization: null, token: 'account-token' }])
  })

  it('fails instead of sending OMEGA_API_KEY when there is no sign-in and the API-key route settings do not resolve', async () => {
    const { ctx, sent } = await mount({
      routes: [officialRoute({ thinking: 'disabled', reasoningEffort: 'high' }), accountRoute()],
      account: signedOut(), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(false)
    await expect(operate(ctx, operation, 'omega-account')).rejects.toMatchObject({ code: 'WEB_PROVIDER_MISCONFIGURED' })
    expect(sent()).toEqual([])
  })

  it('is not ready and fails without trying the key when the account grant cannot be read', async () => {
    const { ctx, sent } = await mount({
      routes: bothRoutes, account: unreadable(),
      environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(false)
    await expect(operate(ctx, operation, 'omega-account')).rejects.toMatchObject({
      code: 'WEB_PROVIDER_ERROR', message: 'Omega web credential resolution failed: Error: grant unreadable',
    })
    expect(sent()).toEqual([])
  })
})

describe.each(OPERATIONS)('%s in any other conversation', (operation) => {
  const others = ['omega-official', 'moonshotai', undefined] as const

  it.each(others)('sends the key of the Omega API-key route to its origin for route %s, never the account token', async (route) => {
    const asked: string[] = []
    const { ctx, sent } = await mount({ routes: bothRoutes, account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(ctx, operation, route)).toBe(true)
    await operate(ctx, operation, route)
    expect(sent()).toEqual([{ endpoint: `${ROUTE}/${operation}`, authorization: 'Bearer chat-key', token: null }])
    expect(asked).toEqual([])
  })

  it('is not ready on the Omega API-key route with only a sign-in, and names the account billing', async () => {
    const subject = operation === 'search' ? 'Search' : 'Fetch'
    const asked: string[] = []
    const { ctx, sent } = await mount({ routes: bothRoutes, account: signedIn(asked) })
    expect(await ready(ctx, operation, 'omega-official')).toBe(false)
    await expect(operate(ctx, operation, 'omega-official')).rejects.toMatchObject({
      code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
      message: `Omega ${subject} API uses the Omega API key, as this conversation's model provider does, and no key is`
        + ' configured for "OMEGA_API_KEY". Guide the user to add the Omega API key on the Models page or export'
        + ' "OMEGA_API_KEY" in the launching environment, or to sign in to Omega and set'
        + ` web-omega-api.${operation}Billing to "account" on the Web search and fetch settings page.`,
    })
    expect(sent()).toEqual([])
    expect(asked).toEqual([])
  })

  it.each(['moonshotai', undefined])('sends the account token to the account route origin without a key for route %s', async (route) => {
    const asked: string[] = []
    const { ctx, sent } = await mount({ routes: bothRoutes, account: signedIn(asked) })
    expect(await ready(ctx, operation, route)).toBe(true)
    await operate(ctx, operation, route)
    expect(sent()).toEqual([{ endpoint: `${ACCOUNT}/${operation}`, authorization: null, token: 'account-token' }])
    expect(asked).toEqual([`${ACCOUNT}/${operation}`, `${ACCOUNT}/${operation}`])
  })

  it('sends the account token to the default account origin without the account route', async () => {
    const { ctx, sent } = await mount({
      routes: [officialRoute()], account: signedIn(), environment: { OMEGA_BASE_URL: 'https://internal.omega.test/anthropic' },
    })
    expect(await ready(ctx, operation, 'moonshotai')).toBe(true)
    await operate(ctx, operation, 'moonshotai')
    expect(sent()).toEqual([{ endpoint: `https://internal.omega.test/v1/tools/${operation}`, authorization: null, token: 'account-token' }])
  })

  it('sends the account token to the official origin without any model route', async () => {
    const { ctx, sent } = await mount({ account: signedIn() })
    await operate(ctx, operation)
    expect(sent()).toEqual([{ endpoint: `${OFFICIAL}/${operation}`, authorization: null, token: 'account-token' }])
  })

  it.each(['omega-account', 'omega-official'])('orders route %s as any other route while no plugin connected it', async (route) => {
    const asked: string[] = []
    const withKey = await mount({ account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(withKey.ctx, operation, route)).toBe(true)
    await operate(withKey.ctx, operation, route)
    expect(withKey.sent()).toEqual([{ endpoint: `${OFFICIAL}/${operation}`, authorization: 'Bearer chat-key', token: null }])
    expect(asked).toEqual([])
    const signedInOnly = await mount({ account: signedIn() })
    expect(await ready(signedInOnly.ctx, operation, route)).toBe(true)
    await operate(signedInOnly.ctx, operation, route)
    expect(signedInOnly.sent()).toEqual([{ endpoint: `${OFFICIAL}/${operation}`, authorization: null, token: 'account-token' }])
    const neither = await mount({ account: signedOut() })
    expect(await ready(neither.ctx, operation, route)).toBe(false)
    const failure = operate(neither.ctx, operation, route)
    await expect(failure).rejects.toMatchObject({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' })
    await expect(failure).rejects.toThrow('uses the Omega API key, then the Omega account sign-in, and neither is available')
  })

  it('is not ready and names both recoveries without a key and a sign-in', async () => {
    const subject = operation === 'search' ? 'Search' : 'Fetch'
    for (const account of [signedOut(), undefined]) {
      const { ctx, sent } = await mount({ routes: bothRoutes, ...account === undefined ? {} : { account } })
      expect(await ready(ctx, operation, 'moonshotai')).toBe(false)
      await expect(operate(ctx, operation, 'moonshotai')).rejects.toMatchObject({
        code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
        message: `Omega ${subject} API uses the Omega API key, then the Omega account sign-in, and neither is available:`
          + ' no key is configured for "OMEGA_API_KEY", and no signed-in Omega account is available. Guide the user to'
          + ' add the Omega API key on the Models page or export "OMEGA_API_KEY" in the launching environment, or to'
          + ' sign in to Omega.',
      })
      expect(sent()).toEqual([])
    }
  })

  it('sends the key while the mounted account route settings do not resolve, and is misconfigured without the key', async () => {
    const subject = operation === 'search' ? 'Search' : 'Fetch'
    const routes = [officialRoute(), accountRoute({ thinking: 'disabled', reasoningEffort: 'high' })]
    const withKey = await mount({ routes, account: signedIn(), environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(withKey.ctx, operation, 'moonshotai')).toBe(true)
    await operate(withKey.ctx, operation, 'moonshotai')
    expect(withKey.sent()).toEqual([{ endpoint: `${ROUTE}/${operation}`, authorization: 'Bearer chat-key', token: null }])
    const asked: string[] = []
    const withoutKey = await mount({ routes, account: signedIn(asked) })
    expect(await ready(withoutKey.ctx, operation, 'moonshotai')).toBe(false)
    await expect(operate(withoutKey.ctx, operation, 'moonshotai')).rejects.toMatchObject({
      code: 'WEB_PROVIDER_MISCONFIGURED',
      message: `Omega ${subject} API sends the Omega account sign-in to the origin of the Omega account model`
        + ' provider, and that provider\'s settings do not resolve: llm-omega: only reasoningEffort "off" can be configured'
        + ` when thinking is disabled. ${subject} did not send the request. Guide the user to correct that provider's settings`
        + ' on the Models page or in the deployment configuration, or to set'
        + ` web-omega-api.${operation}BaseURL and web-omega-api.${operation}ApiKeyEnv so ${subject} uses its own endpoint.`,
    })
    expect(withoutKey.sent()).toEqual([])
    expect(asked).toEqual([])
  })

  it('fails without asking the account when the credential store cannot be read', async () => {
    const asked: string[] = []
    const { ctx, sent } = await mount({
      routes: bothRoutes, account: signedIn(asked),
      credentials: { describe: () => Promise.reject(new Error('store locked')), resolve: () => Promise.reject(new Error('store locked')) },
    })
    expect(await ready(ctx, operation, 'moonshotai')).toBe(false)
    await expect(operate(ctx, operation, 'moonshotai')).rejects.toMatchObject({
      code: 'WEB_PROVIDER_ERROR', message: 'Omega web credential resolution failed: Error: store locked',
    })
    expect(sent()).toEqual([])
    expect(asked).toEqual([])
  })

  it('sends the key under the route apiKeyEnv to the origin OMEGA_BASE_URL names, from the credential store', async () => {
    const { ctx, sent } = await mount({
      routes: [officialRoute({ apiKeyEnv: 'TEAM_KEY' })],
      credentials: { describe: async (ref: string) => ({ configured: ref === 'TEAM_KEY' }), resolve: async (ref: string) => ref === 'TEAM_KEY' ? { value: 'team-key' } : undefined },
      environment: { OMEGA_API_KEY: 'chat-key', OMEGA_BASE_URL: 'https://internal.omega.test/anthropic' },
    })
    expect(await ready(ctx, operation, 'omega-official')).toBe(true)
    await operate(ctx, operation, 'omega-official')
    expect(sent()).toEqual([{ endpoint: `https://internal.omega.test/v1/tools/${operation}`, authorization: 'Bearer team-key', token: null }])
  })

  it.each<[string, readonly RouteRow[] | undefined]>([
    ['no model service is mounted', undefined],
    ['no route registers omega-official', [accountRoute()]],
    ['the registered omega-official adapter connects no deployment', [{ provider: 'omega-official', config: { apiKeyEnv: 'TEAM_KEY' }, withoutConnection: true }]],
  ])('sends OMEGA_API_KEY to the official base when %s', async (_label, routes) => {
    const { ctx, sent } = await mount({
      ...routes === undefined ? {} : { routes },
      environment: { OMEGA_API_KEY: 'chat-key', TEAM_KEY: 'team-key', OMEGA_BASE_URL: 'https://internal.omega.test/anthropic' },
    })
    expect(await ready(ctx, operation, 'omega-official')).toBe(true)
    await operate(ctx, operation, 'omega-official')
    expect(sent()).toEqual([{ endpoint: `${OFFICIAL}/${operation}`, authorization: 'Bearer chat-key', token: null }])
  })

  it.each<[string, Record<string, unknown>, string]>([
    [
      'thinking is disabled with a reasoning effort', { thinking: 'disabled', reasoningEffort: 'high' },
      'llm-omega: only reasoningEffort "off" can be configured when thinking is disabled',
    ],
    [
      'the base URL carries credentials', { baseURL: 'https://user:secret@internal.omega.test/anthropic' },
      'llm-omega: Messages baseURL must be an HTTP(S) root without credentials, query, or fragment',
    ],
  ])('is not ready and fails without sending when the mounted route settings do not resolve because %s', async (_label, config, reason) => {
    const subject = operation === 'search' ? 'Search' : 'Fetch'
    const { ctx, sent } = await mount({
      routes: [officialRoute({ apiKeyEnv: 'TEAM_KEY', ...config })],
      environment: { OMEGA_API_KEY: 'chat-key', TEAM_KEY: 'team-key' },
    })
    for (const route of ['omega-official', 'moonshotai', undefined]) {
      expect(await ready(ctx, operation, route)).toBe(false)
      await expect(operate(ctx, operation, route)).rejects.toMatchObject({
        code: 'WEB_PROVIDER_MISCONFIGURED',
        message: `Omega ${subject} API sends that provider's API key to the origin of the Omega API-key model provider,`
          + ` and that provider's settings do not resolve: ${reason}. ${subject} did not send the request. Guide the user to`
          + ' correct that provider\'s settings on the Models page or in the deployment configuration, or to set'
          + ` web-omega-api.${operation}BaseURL and web-omega-api.${operation}ApiKeyEnv so ${subject} uses its own endpoint.`,
      })
    }
    expect(sent()).toEqual([])
  })

  it('uses its own endpoint settings while the mounted route settings do not resolve', async () => {
    const { ctx, sent } = await mount({
      config: { [`${operation}BaseURL`]: OWN },
      routes: [officialRoute({ thinking: 'disabled', reasoningEffort: 'high' })], environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-official')).toBe(true)
    await operate(ctx, operation, 'omega-official')
    expect(sent()).toEqual([{ endpoint: `${OWN}/${operation}`, authorization: 'Bearer chat-key', token: null }])
  })

  it('is not ready when the credential store cannot be read', async () => {
    const { ctx } = await mount({ routes: [officialRoute()], credentials: { describe: () => Promise.reject(new Error('store locked')) } })
    expect(await ready(ctx, operation, 'omega-official')).toBe(false)
  })

  it('follows a route change at the next operation', async () => {
    const { ctx, sent } = await mount({ environment: { OMEGA_API_KEY: 'chat-key' } })
    await operate(ctx, operation)
    provideRoutes(ctx, [officialRoute({ baseURL: 'https://next.omega.test/anthropic' })])
    await operate(ctx, operation)
    expect(sent().map(row => row.endpoint)).toEqual([`${OFFICIAL}/${operation}`, `https://next.omega.test/v1/tools/${operation}`])
  })

  it('names the model provider base URL and the own fields in endpoint guidance', async () => {
    const subject = operation === 'search' ? 'Search' : 'Fetch'
    const { ctx } = await mount({ routes: [officialRoute()], environment: { OMEGA_API_KEY: 'chat-key' }, status: 404 })
    await expect(operate(ctx, operation)).rejects.toMatchObject({
      code: 'WEB_PROVIDER_ERROR',
      message: 'Omega API error (HTTP 404)\n\n'
        + `The web request used endpoint "${ROUTE}/${operation}". ${subject} derives this endpoint from the base URL of the`
        + ' Omega model provider whose credential it uses. If that endpoint is not intended, guide the user to check that'
        + ` provider's base URL on the Models page, or to set web-omega-api.${operation}BaseURL to a trusted Omega`
        + ` endpoint and web-omega-api.${operation}ApiKeyEnv to the credential reference of its API key. Only the user`
        + ' should choose or change the endpoint.',
    })
  })
})

const ROUTES = ['omega-account', 'omega-official', 'moonshotai', undefined] as const

describe.each(OPERATIONS)('%s billed to the signed-in Omega account', (operation) => {
  const subject = operation === 'search' ? 'Search' : 'Fetch'
  const config = { [`${operation}Billing`]: 'account' }

  it.each(ROUTES)('sends only the account token to the account route origin for route %s, despite a key', async (route) => {
    const asked: string[] = []
    const { ctx, sent } = await mount({ config, routes: bothRoutes, account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(ctx, operation, route)).toBe(true)
    await operate(ctx, operation, route)
    expect(sent()).toEqual([{ endpoint: `${ACCOUNT}/${operation}`, authorization: null, token: 'account-token' }])
    expect(asked).toEqual([`${ACCOUNT}/${operation}`, `${ACCOUNT}/${operation}`])
  })

  it('sends the token to the default account origin without the account route', async () => {
    const { ctx, sent } = await mount({
      config, routes: [officialRoute()], account: signedIn(),
      environment: { OMEGA_API_KEY: 'chat-key', OMEGA_BASE_URL: 'https://internal.omega.test/anthropic' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(true)
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `https://internal.omega.test/v1/tools/${operation}`, authorization: null, token: 'account-token' }])
  })

  it.each<[string, Setup['account']]>([
    ['the user is not signed in', signedOut()],
    ['no account service is mounted', undefined],
  ])('is not ready and never sends the key when %s', async (_label, account) => {
    const { ctx, sent } = await mount({
      config, routes: bothRoutes, ...account === undefined ? {} : { account }, environment: { OMEGA_API_KEY: 'chat-key' },
    })
    for (const route of ROUTES) {
      expect(await ready(ctx, operation, route)).toBe(false)
      await expect(operate(ctx, operation, route)).rejects.toMatchObject({
        code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
        message: `Omega ${subject} API bills only the signed-in Omega account, and no signed-in Omega account is`
          + ` available. ${subject} did not send the request. Guide the user to sign in to Omega, or to set`
          + ` web-omega-api.${operation}Billing to "api-key" or "auto" on the Web search and fetch settings page.`,
      })
    }
    expect(sent()).toEqual([])
  })

  it('is not ready and fails without a token when the mounted account route settings do not resolve', async () => {
    const asked: string[] = []
    const { ctx, sent } = await mount({
      config, routes: [officialRoute(), accountRoute({ thinking: 'disabled', reasoningEffort: 'high' })],
      account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'moonshotai')).toBe(false)
    const failure = operate(ctx, operation, 'moonshotai')
    await expect(failure).rejects.toMatchObject({ code: 'WEB_PROVIDER_MISCONFIGURED' })
    await expect(failure).rejects.toThrow('Omega account model provider, and that provider\'s settings do not resolve')
    expect(sent()).toEqual([])
    expect(asked).toEqual([])
  })

  it('is not ready and never sends the key without the account route and the account service', async () => {
    const { ctx, sent } = await mount({ config, routes: [officialRoute()], environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(ctx, operation, 'moonshotai')).toBe(false)
    await expect(operate(ctx, operation, 'moonshotai')).rejects.toMatchObject({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' })
    expect(sent()).toEqual([])
  })

  it.each(['https://user:secret@internal.omega.test/anthropic', 'https://:secret@internal.omega.test/anthropic', 'ftp://internal.omega.test/anthropic', 'not a url'])(
    'is not ready and fails without a token when OMEGA_BASE_URL is %s and no account route is mounted', async (baseURL) => {
      const asked: string[] = []
      const { ctx, sent } = await mount({ config, account: signedIn(asked), environment: { OMEGA_BASE_URL: baseURL } })
      expect(await ready(ctx, operation, undefined)).toBe(false)
      const failure = operate(ctx, operation)
      await expect(failure).rejects.toMatchObject({ code: 'WEB_PROVIDER_MISCONFIGURED' })
      await expect(failure).rejects.toThrow(`Omega ${subject} API sends the Omega account sign-in to the origin of OMEGA_BASE_URL,`
        + ' and that value does not resolve: ')
      await expect(failure).rejects.toThrow('Guide the user to correct OMEGA_BASE_URL in the launching environment, or to set')
      expect(sent()).toEqual([])
      expect(asked).toEqual([])
    },
  )

  it('is not ready and fails when the account grant cannot be read', async () => {
    const { ctx, sent } = await mount({
      config, routes: bothRoutes, account: unreadable(),
      environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'moonshotai')).toBe(false)
    await expect(operate(ctx, operation, 'moonshotai')).rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    expect(sent()).toEqual([])
  })

  it('invalidates the token the API rejects with 401', async () => {
    const rejectToken = vi.fn(async (_token: string) => {})
    const { ctx } = await mount({ config, routes: bothRoutes, account: signedIn([], rejectToken), status: 401 })
    await expect(operate(ctx, operation, 'moonshotai')).rejects.toThrow('HTTP 401')
    expect(rejectToken).toHaveBeenCalledExactlyOnceWith('account-token')
  })
})

describe.each(OPERATIONS)('%s billed to the Omega API key', (operation) => {
  const subject = operation === 'search' ? 'Search' : 'Fetch'
  const config = { [`${operation}Billing`]: 'api-key' }

  it.each(ROUTES)('sends only the route key to the route origin for route %s, despite a sign-in', async (route) => {
    const asked: string[] = []
    const { ctx, sent } = await mount({ config, routes: bothRoutes, account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key' } })
    expect(await ready(ctx, operation, route)).toBe(true)
    await operate(ctx, operation, route)
    expect(sent()).toEqual([{ endpoint: `${ROUTE}/${operation}`, authorization: 'Bearer chat-key', token: null }])
    expect(asked).toEqual([])
  })

  it('sends OMEGA_API_KEY to the official base without the API-key route', async () => {
    const { ctx, sent } = await mount({ config, routes: [accountRoute()], account: signedIn(), environment: { OMEGA_API_KEY: 'chat-key' } })
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `${OFFICIAL}/${operation}`, authorization: 'Bearer chat-key', token: null }])
  })

  it('is not ready and never sends the token without a key', async () => {
    const asked: string[] = []
    const { ctx, sent } = await mount({ config, routes: bothRoutes, account: signedIn(asked) })
    for (const route of ROUTES) {
      expect(await ready(ctx, operation, route)).toBe(false)
      await expect(operate(ctx, operation, route)).rejects.toMatchObject({
        code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
        message: `Omega ${subject} API bills only the Omega API key, and no key is configured for "OMEGA_API_KEY".`
          + ' Guide the user to add the Omega API key on the Models page or export "OMEGA_API_KEY" in the launching'
          + ` environment, or to set web-omega-api.${operation}Billing to "account" or "auto" on the Web search and fetch`
          + ' settings page.',
      })
    }
    expect(sent()).toEqual([])
    expect(asked).toEqual([])
  })

  it('is not ready and fails without sending when the mounted API-key route settings do not resolve', async () => {
    const { ctx, sent } = await mount({
      config, routes: [officialRoute({ thinking: 'disabled', reasoningEffort: 'high' }), accountRoute()],
      account: signedIn(), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(false)
    const failure = operate(ctx, operation, 'omega-account')
    await expect(failure).rejects.toMatchObject({ code: 'WEB_PROVIDER_MISCONFIGURED' })
    await expect(failure).rejects.toThrow('Omega API-key model provider, and that provider\'s settings do not resolve')
    expect(sent()).toEqual([])
  })
})

describe.each(OPERATIONS)('%s billing under its own endpoint settings', (operation) => {
  it.each(['account', 'api-key'])('ignores %s billing and sends the own key to the own base', async (billing) => {
    const asked: string[] = []
    const { ctx, sent } = await mount({
      config: { [`${operation}Billing`]: billing, [`${operation}BaseURL`]: OWN }, routes: bothRoutes, account: signedIn(asked),
      environment: { OMEGA_API_KEY: 'chat-key' },
    })
    for (const route of ROUTES) {
      expect(await ready(ctx, operation, route)).toBe(true)
      await operate(ctx, operation, route)
    }
    expect(sent()).toEqual(ROUTES.map(() => ({ endpoint: `${OWN}/${operation}`, authorization: 'Bearer chat-key', token: null })))
    expect(asked).toEqual([])
  })
})

describe.each(OPERATIONS)('%s with its own endpoint settings', (operation) => {
  const subject = operation === 'search' ? 'Search' : 'Fetch'
  const baseURL = `${operation}BaseURL`, apiKeyEnv = `${operation}ApiKeyEnv`

  it.each<[string, Record<string, unknown>, Sent]>([
    ['only a base URL', { [baseURL]: OWN }, { endpoint: `${OWN}/${operation}`, authorization: 'Bearer chat-key', token: null }],
    ['only a key reference', { [apiKeyEnv]: 'OWN_KEY' }, { endpoint: `${OFFICIAL}/${operation}`, authorization: 'Bearer own-key', token: null }],
    ['both', { [baseURL]: OWN, [apiKeyEnv]: 'OWN_KEY' }, { endpoint: `${OWN}/${operation}`, authorization: 'Bearer own-key', token: null }],
    ['a base URL with trailing slashes', { [baseURL]: `${OWN}//` }, { endpoint: `${OWN}/${operation}`, authorization: 'Bearer chat-key', token: null }],
  ])('uses %s on every conversation route and never the account token', async (_label, config, expected) => {
    const asked: string[] = []
    const { ctx, sent } = await mount({
      config, routes: bothRoutes, account: signedIn(asked), environment: { OMEGA_API_KEY: 'chat-key', OWN_KEY: 'own-key' },
    })
    for (const route of ['omega-account', 'omega-official', 'moonshotai']) {
      expect(await ready(ctx, operation, route)).toBe(true)
      await operate(ctx, operation, route)
    }
    expect(sent()).toEqual([expected, expected, expected])
    expect(asked).toEqual([])
  })

  it('is not ready without its key, despite a sign-in and the route key', async () => {
    const { ctx, sent } = await mount({
      config: { [apiKeyEnv]: 'OWN_KEY' }, routes: bothRoutes, account: signedIn(), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, operation, 'omega-account')).toBe(false)
    await expect(operate(ctx, operation, 'omega-account')).rejects.toMatchObject({
      code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
      message: `Omega ${subject} API sends the API key under "OWN_KEY" to its own endpoint, and no key is configured for`
        + ' "OWN_KEY". Guide the user to export "OWN_KEY" in the launching environment, or to correct'
        + ` web-omega-api.${operation}ApiKeyEnv.`,
    })
    expect(sent()).toEqual([])
  })

  it('treats empty values as unset and follows the conversation', async () => {
    const { ctx, sent } = await mount({
      config: { [baseURL]: '', [apiKeyEnv]: '' }, routes: bothRoutes, account: signedIn(), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    await operate(ctx, operation, 'omega-account')
    expect(sent()).toEqual([{ endpoint: `${ACCOUNT}/${operation}`, authorization: null, token: 'account-token' }])
  })

  it.each(['not a url', 'https://user:secret@own.omega.test/api/v1/tools'])('reports the base URL %s, which does not parse or embeds credentials, as an unavailable provider', async (value) => {
    const { ctx, sent } = await mount({ config: { [baseURL]: value }, environment: { OMEGA_API_KEY: 'chat-key' } })
    await expect(operate(ctx, operation)).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE' })
    expect(sent()).toEqual([])
  })
})

describe('independent capabilities', () => {
  it('resolves Search from its own settings while Fetch follows the conversation', async () => {
    const { ctx, sent } = await mount({
      config: { searchBaseURL: OWN }, routes: bothRoutes, account: signedIn(), environment: { OMEGA_API_KEY: 'chat-key' },
    })
    await operate(ctx, 'search', 'omega-account')
    await operate(ctx, 'fetch', 'omega-account')
    expect(sent()).toEqual([
      { endpoint: `${OWN}/search`, authorization: 'Bearer chat-key', token: null },
      { endpoint: `${ACCOUNT}/fetch`, authorization: null, token: 'account-token' },
    ])
  })

  it('bills Search to the account and Fetch to the API key from their own settings', async () => {
    const { ctx, sent } = await mount({
      config: { searchBilling: 'account', fetchBilling: 'api-key' }, routes: bothRoutes, account: signedIn(),
      environment: { OMEGA_API_KEY: 'chat-key' },
    })
    await operate(ctx, 'search', 'moonshotai')
    await operate(ctx, 'fetch', 'moonshotai')
    expect(sent()).toEqual([
      { endpoint: `${ACCOUNT}/search`, authorization: null, token: 'account-token' },
      { endpoint: `${ROUTE}/fetch`, authorization: 'Bearer chat-key', token: null },
    ])
  })

  it('reports one capability not ready while the other is ready', async () => {
    const { ctx } = await mount({ config: { fetchApiKeyEnv: 'UNSET_KEY' }, routes: [officialRoute()], environment: { OMEGA_API_KEY: 'chat-key' } })
    expect([await ready(ctx, 'search', undefined), await ready(ctx, 'fetch', undefined)]).toEqual([true, false])
  })
})

describe('model route settings failures', () => {
  it('reports a thrown non-Error value as its string', async () => {
    const { ctx, sent } = await mount({
      routes: [{ provider: 'omega-official', throws: 'route resolver unavailable' }], environment: { OMEGA_API_KEY: 'chat-key' },
    })
    const failure = operate(ctx, 'search', 'omega-official')
    await expect(failure).rejects.toMatchObject({ code: 'WEB_PROVIDER_MISCONFIGURED' })
    await expect(failure).rejects.toThrow('that provider\'s settings do not resolve: route resolver unavailable. Search did not send')
    expect(sent()).toEqual([])
  })

  it('reports a route whose base URL does not parse as misconfigured, before readiness and without sending', async () => {
    const { ctx, sent } = await mount({
      routes: [{ provider: 'omega-official', connectedBaseURL: 'not a url' }], environment: { OMEGA_API_KEY: 'chat-key' },
    })
    expect(await ready(ctx, 'search', 'omega-official')).toBe(false)
    const failure = operate(ctx, 'search', 'omega-official')
    await expect(failure).rejects.toMatchObject({ code: 'WEB_PROVIDER_MISCONFIGURED' })
    await expect(failure).rejects.toThrow('that provider\'s settings do not resolve: Invalid URL. Search did not send')
    expect(sent()).toEqual([])
  })
})

describe('billing settings', () => {
  it('defaults both capabilities to automatic billing and rejects an unknown billing', () => {
    const config = webApiPlugin.Config({})
    expect([config.searchBilling.get(), config.fetchBilling.get()]).toEqual(['auto', 'auto'])
    // @ts-expect-error A stored settings file can carry a value outside the billing union.
    expect(() => webApiPlugin.Config({ searchBilling: 'session' })).toThrow()
  })
})

describe('stored settings', () => {
  const removed = {
    baseURL: 'https://legacy.omega.test/v1/tools', apiKeyEnv: 'LEGACY_KEY', apiKey: 'legacy-key',
  }

  it('loads stored removed fields without error and leaves both capabilities unset', () => {
    const config = webApiPlugin.Config(removed)
    expect([config.searchBaseURL.get(), config.searchApiKeyEnv.get(), config.fetchBaseURL.get(), config.fetchApiKeyEnv.get()])
      .toEqual([undefined, undefined, undefined, undefined])
  })

  it.each(OPERATIONS)('ignores removed fields when a %s runs', async (operation) => {
    const { ctx, sent } = await mount({ config: removed, environment: { OMEGA_API_KEY: 'chat-key', LEGACY_KEY: 'legacy-env-key' } })
    await operate(ctx, operation)
    expect(sent()).toEqual([{ endpoint: `${OFFICIAL}/${operation}`, authorization: 'Bearer chat-key', token: null }])
  })
})

describe('provider registration', () => {
  it('lists both APIs with their descriptions for the provider menus', async () => {
    const { ctx } = await mount({})
    const { search, fetch } = ctx.web.listProviders()
    expect(search.map(({ id }) => id)).toEqual(['omega-search-api'])
    expect(fetch.map(({ id }) => id)).toEqual(['omega-fetch-api'])
    expect(search[0]?.description).toMatchObject({
      en: 'Incurs charges, paid by the account or API key chosen under Billing.',
      zh: '会产生费用，由「计费方式」选定的账号或 API Key 支付。',
    })
    expect(fetch[0]?.description).toMatchObject({
      en: "Can't reach intranet or local addresses. Incurs charges, paid by the account or API key chosen under Billing.",
      zh: '无法访问内网和本机。会产生费用，由「计费方式」选定的账号或 API Key 支付。',
    })
  })
})
