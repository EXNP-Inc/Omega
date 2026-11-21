/**
 * Register a Omega-backed provider in `ctx.web`. It calls the Anthropic-compatible Messages API
 * with native `web_search_20250305`. `ctx.omegaAuth` releases its credential: a search initiated by
 * a Session whose latest model request used the Omega account route authenticates with the account
 * sign-in when the search endpoint has the origin of that route's base URL and the account service
 * allows the endpoint; every other search reuses `OMEGA_API_KEY`. The provider
 * does not reuse `OMEGA_BASE_URL`; auxiliary search has its own endpoint configuration. The
 * provider reports itself not ready for a model request whose search would have no credential.
 * @module @omega-ai/dsh-web-search-omega
 */
import type { Volatile } from '@omega-ai/cordis'

import type { Context } from '@omega-ai/cordis'
import z from '@omega-ai/schemastery'
import type {} from '@omega-ai/dsh-agent'
import { credentialRef } from '@omega-ai/dsh-credentials'
import type { OmegaAuthRequest } from '@omega-ai/dsh-omega-auth'
import { launchEnvironmentOf } from '@omega-ai/dsh-launch-environment'
import type {} from '@omega-ai/dsh-session'
import type {} from '@omega-ai/dsh-web'
import {
  OmegaSearchProvider,
  OMEGA_DEFAULT_API_VERSION,
  OMEGA_DEFAULT_BASE_URL,
  OMEGA_DEFAULT_MAX_TOKENS,
  OMEGA_DEFAULT_MAX_USES,
  OMEGA_DEFAULT_MODEL,
} from './provider.ts'
import type { OmegaSearchProviderOptions } from './provider.ts'

export {
  OmegaSearchProvider,
  OMEGA_DEFAULT_API_VERSION,
  OMEGA_DEFAULT_BASE_URL,
  OMEGA_DEFAULT_MAX_TOKENS,
  OMEGA_DEFAULT_MAX_USES,
  OMEGA_DEFAULT_MODEL,
  OMEGA_PROVIDER_ID,
} from './provider.ts'
export type { OmegaSearchLlmRequest, OmegaSearchProviderOptions } from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-omega'

/** The web seam this provider registers into, and the Omega authentication its searches ask for credentials. */
export const inject = ['web', 'omegaAuth']

const DEFAULT_API_KEY_ENV = 'OMEGA_API_KEY'

/** Plugin config (all optional — `apply` fills env-var and constant defaults). */
export interface Config {
  /** Literal Omega API key; prefer {@link apiKeyEnv} so no secret enters configuration files. */
  apiKey: Volatile<string | undefined>
  /** Credential reference resolved for each search; defaults to `OMEGA_API_KEY`. */
  apiKeyEnv: Volatile<string>
  /** Anthropic-compatible endpoint base; `/messages` is appended. */
  baseURL: Volatile<string | undefined>
  /** Anthropic-format model name. Defaults to `omega-v4-flash`. */
  model: Volatile<string>
  /** `anthropic-version` header value. Defaults to `2023-06-01`. */
  apiVersion: Volatile<string>
  /** Upper bound on generated tokens for the Messages request. Defaults to 4096. */
  maxTokens: Volatile<number>
  /** Maximum `web_search` server-tool uses per request. Defaults to 5. */
  maxUses: Volatile<number>
}

export const Config = z.object({
  apiKey: z.string().role('secret').volatile(),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV).volatile(),
  // Declared here rather than only at the use site: a configuration surface
  // renders the resolved section, so a default the schema does not carry reads
  // there as no value at all.
  baseURL: z.string().volatile(),
  model: z.string().default(OMEGA_DEFAULT_MODEL).volatile(),
  apiVersion: z.string().default(OMEGA_DEFAULT_API_VERSION).volatile(),
  maxTokens: z.number().step(1).min(1).default(OMEGA_DEFAULT_MAX_TOKENS).volatile(),
  maxUses: z.number().step(1).min(1).default(OMEGA_DEFAULT_MAX_USES).volatile(),
})

/**
 * Auxiliary-search endpoint, independent of the conversation adapter's
 * `$OMEGA_BASE_URL` and selected protocol.
 */
const SEARCH_BASE_URL_ENV = 'OMEGA_SEARCH_BASE_URL'

/** Settings namespace carrying this provider's endpoint, model, and key reference. */
export const WEB_SEARCH_OMEGA_SETTINGS_NAMESPACE = 'web-search-omega'

/** Options for one search, with what the search asks `ctx.omegaAuth`. */
type SearchOptions = OmegaSearchProviderOptions & {
  /**
   * The request a search to `endpoint` makes for a model request on `route`, or `undefined` when the literal key is
   * the only credential it can send.
   */
  readonly authRequest: (route: string | undefined, endpoint: string) => OmegaAuthRequest | undefined
}

/**
 * Project one resolved section into the options the provider serves its next
 * search with. Environment fallbacks stay here rather than in the provider:
 * every value it reads is already fully defaulted.
 * @param ctx - plugin context supplying the Omega authentication, the Agent registry, and the environment.
 * @param config - the currently authoritative section.
 * @returns options for one search.
 */
function resolveOptions(
  ctx: Context, config: { [K in keyof Config]: ReturnType<Config[K]['get']> },
): SearchOptions {
  const reference = credentialRef(config.apiKeyEnv)
  const literalApiKey = config.apiKey !== undefined && config.apiKey.length > 0
    ? config.apiKey
    : undefined
  const baseURL = config.baseURL
    ?? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value
    ?? OMEGA_DEFAULT_BASE_URL
  const authRequest = (route: string | undefined, endpoint: string): OmegaAuthRequest | undefined => {
    // The account sign-in pays only for a conversation on the account route, and only through that route.
    const accountConversation = ctx.omegaAuth.routeKind(route) === 'account'
    if (literalApiKey !== undefined && !accountConversation) return undefined
    return {
      consumer: name,
      // A literal key is this provider's own credential, so beside it only the account sign-in is asked for.
      accepts: literalApiKey === undefined ? ['account', 'api-key'] : ['account'],
      billing: accountConversation ? 'auto' : 'api-key',
      route,
      destination: { url: endpoint },
      // The referenced key is this provider's own too: it goes to the search endpoint, whatever the API-key route uses.
      connections: { 'api-key': { baseURL, reference } },
      // Official Omega expects `x-api-key`; an Anthropic-compatible proxy may expect `Authorization: Bearer`.
      apiKeyHeaders: ['x-api-key', 'authorization'],
    }
  }
  return {
    ...literalApiKey === undefined ? {} : { apiKey: literalApiKey },
    authRequest,
    authorize: async (endpoint, signal) => {
      // The latest request context names the route that served the model
      // request which called this search, as account sign-out reads it.
      const route = ctx.get('agents')?.currentInitiator()?.session.requestContext()?.provider
      const request = authRequest(route, endpoint)
      return request === undefined ? undefined : await ctx.omegaAuth.authorize(request, signal)
    },
    apiKeyEnv: reference,
    baseURL,
    model: config.model,
    apiVersion: config.apiVersion,
    maxTokens: config.maxTokens,
    maxUses: config.maxUses,
    recordRequest: (request) => {
      ctx.get('agents')?.currentInitiator()?.session.append(
        'web/omega-search-llm-request',
        request,
      )
    },
  }
}

/**
 * Whether the search a model request on `route` would make has a credential, checked in the order
 * the search resolves them: on the account route the account sign-in, when the search endpoint has the
 * origin of that route's base URL, then the API key. A route whose settings do not resolve, or a failed
 * read, answers false, because the search fails there instead of trying the next credential. Only
 * presence is checked: the API key's value is not read and the endpoint is not contacted, so a wrong
 * key or an endpoint without native search still counts as configured.
 * @param ctx - plugin context supplying the Omega authentication.
 * @param options - options the next search would use.
 * @param route - provider route of the model request being assembled.
 * @returns whether the account sign-in or an API key is available to that search.
 */
async function searchConfigured(
  ctx: Context, options: SearchOptions, route: string | undefined,
): Promise<boolean> {
  const request = options.authRequest(route, `${options.baseURL}/messages`)
  for (const candidate of request === undefined ? [] : ctx.omegaAuth.candidates(request)) {
    // The search stops at a route whose settings do not resolve before it reads any credential.
    if ('unresolved' in candidate) return false
    try { if (await candidate.configured()) return true }
    catch (_unreadableCredential) { return false /* The search fails on this read before it tries the next credential. */ }
  }
  return options.apiKey !== undefined
}

/**
 * Register the Omega search provider with `ctx.web`. Its `ready()` answers whether a
 * search for a model request on the given route would have a credential to send.
 */
export function apply(ctx: Context, config: Config): void {
  const options = () => resolveOptions(ctx, {
    apiKey: config.apiKey.get(), apiKeyEnv: config.apiKeyEnv.get(), baseURL: config.baseURL.get(), model: config.model.get(),
    apiVersion: config.apiVersion.get(), maxTokens: config.maxTokens.get(), maxUses: config.maxUses.get(),
  })
  const provider = new OmegaSearchProvider(options)
  ctx.web.registerSearchProvider({
    id: provider.id,
    description: provider.description,
    available: () => provider.available(),
    ready: llmProvider => searchConfigured(ctx, options(), llmProvider),
    search: (request, signal) => provider.search(request, signal),
  })
}
