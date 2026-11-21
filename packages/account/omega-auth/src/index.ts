/**
 * Omega request authentication (`ctx.omegaAuth`). Omega APIs accept two kinds of credential, the API key and
 * the account sign-in, and each API accepts one or both. A consumer names the kinds its API accepts and the billing
 * its settings choose; this service orders the kinds, binds each to the deployment its credential belongs to, and
 * releases the request headers of the first kind that has a credential. Model route plugins connect the deployment
 * their settings name; without a connection the API key is `OMEGA_API_KEY` at the official API and the account
 * sign-in goes to the deployment `OMEGA_BASE_URL` names.
 *
 * ```ts
 * const authorization = await ctx.omegaAuth.authorize({
 *   consumer: name, accepts: ['account', 'api-key'], billing: 'auto', route, destination: { path: '/v1/tools/search' },
 * }, signal)
 * ```
 *
 * @module @omega-ai/dsh-omega-auth
 */
import { Context, Service } from '@omega-ai/cordis'
import { credentialRef, credentialRefConfigured, normalizeApiKey, resolveCredentialRef } from '@omega-ai/dsh-credentials'
import type { ApiKeyRejection } from '@omega-ai/dsh-credentials'
import type {} from '@omega-ai/dsh-omega-account'
import { HarnessError } from '@omega-ai/dsh-error'
import { launchEnvironmentOf } from '@omega-ai/dsh-launch-environment'
import type {
  OmegaAuthCandidate, OmegaAuthConnection, OmegaAuthKind, OmegaAuthRequest, OmegaAuthUnresolved,
  OmegaAuthorization,
} from './types.ts'

export type * from './types.ts'

declare module '@omega-ai/cordis' {
  interface Context { omegaAuth: OmegaAuth }
}

/** Base URL of the official Omega API, where `OMEGA_API_KEY` is sent without a connected API-key route. */
const OFFICIAL_BASE_URL = 'https://api.omega.com'

/** Credential reference of the official Omega API key. */
const OMEGA_API_KEY = credentialRef('OMEGA_API_KEY')

/**
 * Launch-environment variable naming the Omega deployment the model routes default to. Without a connected account
 * route, its origin receives the account sign-in.
 */
const OMEGA_BASE_URL_ENV = 'OMEGA_BASE_URL'

/** Failure codes of {@link OmegaAuthError}. */
export type OmegaAuthErrorCode =
  /** A second connection of one kind; one model route plugin owns each kind's deployment. */
  | 'DUPLICATE_CONNECTION'
  /** The configured API key is blank or cannot travel in an HTTP header. */
  | 'INVALID_CREDENTIAL'
  /** The connection of the kind an operation reached does not resolve. */
  | 'UNRESOLVED_CONNECTION'

/** A Omega authentication failure; `message` never contains a credential. */
export class OmegaAuthError extends HarnessError {
  declare readonly code: OmegaAuthErrorCode

  /**
   * @param message - what failed and what to change.
   * @param code - the failure class.
   * @param options - the underlying failure.
   */
  constructor(message: string, code: OmegaAuthErrorCode, options?: ErrorOptions) {
    super(message, code, options)
    // Consumers quote this name in their own diagnostics, so it does not follow a bundler's class renaming.
    this.name = 'OmegaAuthError'
  }
}

/**
 * The diagnostic for a configured API key that cannot be sent. The key never enters the text: `reference` names where to
 * fix it. The Models page is named as the writer it usually is, not as the only one, because the same value can arrive
 * from a hand-edited `.env` or a shell export in a composition that mounts no credentials service.
 * @param reason - why the key cannot be sent.
 * @param owner - settings namespace or plugin name prefixed to the text.
 * @param reference - the credential reference the key was read under.
 * @returns the message of the `INVALID_CREDENTIAL` failure.
 */
function unusableKey(reason: ApiKeyRejection, owner: string, reference: string): string {
  const defect: Record<ApiKeyRejection, string> = {
    empty: `is blank; set ${reference} to the raw key (the web Models page writes it) or export it in the launching`
      + ' environment',
    illegalCharacters: `contains characters no HTTP header can carry; set ${reference} to the raw key alone (the web Models`
      + ' page writes it)',
  }
  return `${owner}: the API key resolved from ${reference} ${defect[reason]}`
}

/** Marks a failure of the launch-environment deployment, apart from a failure of a connected route's settings. */
class DeploymentError extends Error {
  /** @param cause - why the variable's value is no deployment URL. */
  constructor(cause: unknown) { super('unresolved deployment', { cause }) }
}

/** `ctx.omegaAuth`: the two Omega credential kinds behind one request-authorization operation. */
export class OmegaAuth extends Service {
  private readonly connections = new Map<OmegaAuthKind, { route: string; connection: () => OmegaAuthConnection }>()

  /** @param ctx - Host context; the credentials service and the account service are read when mounted. */
  constructor(ctx: Context) {
    super(ctx, 'omegaAuth')
  }

  /**
   * Connect the deployment a model route plugin's settings name for one kind. Call it from within `ctx.effect()`.
   * @param kind - the kind the plugin's route bills.
   * @param route - provider route the plugin registers; {@link routeKind} answers `kind` for it while connected.
   * @param connection - reads the plugin's current settings; a throw marks the kind unresolved for that operation.
   * @returns the disposer removing the connection.
   * @throws {OmegaAuthError} code `DUPLICATE_CONNECTION` when the kind is already connected.
   */
  connect(kind: OmegaAuthKind, route: string, connection: () => OmegaAuthConnection): () => void {
    if (this.connections.has(kind)) {
      throw new OmegaAuthError(`omega-auth: the ${kind} deployment is already connected`, 'DUPLICATE_CONNECTION')
    }
    this.connections.set(kind, { route, connection })
    return () => { this.connections.delete(kind) }
  }

  /**
   * The kind that bills a conversation on one model route.
   * @param route - provider route of a model request; undefined names none.
   * @returns the kind connected under that route, or undefined for a route no plugin connected.
   */
  routeKind(route: string | undefined): OmegaAuthKind | undefined {
    for (const [kind, connected] of this.connections) {
      if (connected.route === route) return kind
    }
    return undefined
  }

  /**
   * The kinds one request can authenticate with, in the order its billing tries them, each bound to its destination.
   * Nothing is read from a credential store.
   * @param request - the request.
   * @returns candidates and unresolved kinds, first preferred; empty when the destination accepts no kind the
   *   billing allows or no allowed kind serves an absolute destination.
   */
  candidates(request: OmegaAuthRequest): (OmegaAuthCandidate | OmegaAuthUnresolved)[] {
    return this.order(request).filter(kind => request.accepts.includes(kind)).flatMap(kind => this.candidate(kind, request))
  }

  /**
   * Release the credential of the first candidate that has one. A later candidate is not read once an earlier one
   * has a credential, fails to read, or does not resolve.
   * @param request - the request.
   * @param signal - cancellation for the lookups.
   * @returns the authorization, or undefined when no candidate has a credential.
   * @throws {OmegaAuthError} code `UNRESOLVED_CONNECTION` at an unresolved kind, `INVALID_CREDENTIAL` for an
   *   unusable API key; store failures propagate.
   */
  async authorize(request: OmegaAuthRequest, signal?: AbortSignal): Promise<OmegaAuthorization | undefined> {
    for (const candidate of this.candidates(request)) {
      if ('unresolved' in candidate) {
        throw new OmegaAuthError(
          `omega-auth: the ${candidate.kind} ${candidate.unresolved} does not resolve: ${String(candidate.error)}`,
          'UNRESOLVED_CONNECTION', { cause: candidate.error },
        )
      }
      const authorization = await candidate.resolve(signal)
      if (authorization !== undefined) return authorization
    }
    return undefined
  }

  /** The kinds the billing tries, in order, before the destination's accepted kinds narrow them. */
  private order(request: OmegaAuthRequest): OmegaAuthKind[] {
    const billing = request.billing ?? 'auto'
    if (billing !== 'auto') return [billing]
    switch (this.routeKind(request.route)) {
      // A conversation on the account route falls back to the API key.
      case 'account': return ['account', 'api-key']
      case 'api-key': return ['api-key']
      // Every route no plugin connected, whatever its id, and an operation outside a conversation.
      default: return ['api-key', 'account']
    }
  }

  /** Bind one kind to the request's destination; empty when the kind does not serve an absolute destination. */
  private candidate(kind: OmegaAuthKind, request: OmegaAuthRequest): (OmegaAuthCandidate | OmegaAuthUnresolved)[] {
    let connection: OmegaAuthConnection
    try { connection = request.connections?.[kind] ?? this.connections.get(kind)?.connection() ?? this.unconnected(kind) }
    catch (error: unknown) {
      const unresolved = error instanceof DeploymentError ? 'deployment' : 'connection'
      return [{ kind, unresolved, error: error instanceof DeploymentError ? error.cause : error }]
    }
    let endpoint: string
    try {
      const deployment = new URL(connection.baseURL)
      if ('path' in request.destination) endpoint = `${deployment.origin}${request.destination.path}`
      else {
        const destination = new URL(request.destination.url)
        if (destination.origin !== deployment.origin || destination.username !== '' || destination.password !== '') return []
        endpoint = request.destination.url
      }
    } catch (error: unknown) { return [{ kind, unresolved: 'connection', error }] }
    return [kind === 'api-key' ? this.apiKey(connection, endpoint, request) : this.account(endpoint)]
  }

  /** The connection of a kind no model route plugin connected. */
  private unconnected(kind: OmegaAuthKind): OmegaAuthConnection {
    if (kind === 'api-key') return { baseURL: OFFICIAL_BASE_URL }
    const configured = launchEnvironmentOf(this.ctx).get(OMEGA_BASE_URL_ENV)?.value
    if (configured === undefined || configured.length === 0) return { baseURL: OFFICIAL_BASE_URL }
    try {
      const url = new URL(configured)
      if (!/^https?:$/u.test(url.protocol) || url.username.length > 0 || url.password.length > 0) {
        throw new Error(`${OMEGA_BASE_URL_ENV} must be an HTTP(S) URL without credentials`)
      }
    } catch (error: unknown) { throw new DeploymentError(error) }
    return { baseURL: configured }
  }

  /** The API key read under the connection's reference, sent in the headers the request names. */
  private apiKey(connection: OmegaAuthConnection, endpoint: string, request: OmegaAuthRequest): OmegaAuthCandidate {
    const { ctx } = this
    const reference = connection.reference ?? OMEGA_API_KEY
    const owner = connection.owner ?? request.consumer
    return {
      kind: 'api-key', endpoint, reference,
      configured: () => credentialRefConfigured(ctx, reference),
      resolve: async (signal) => {
        signal?.throwIfAborted()
        const raw = await resolveCredentialRef(ctx, reference)
        if (raw === undefined) return undefined
        const checked = normalizeApiKey(raw)
        if (!checked.ok) throw new OmegaAuthError(unusableKey(checked.reason, owner, reference), 'INVALID_CREDENTIAL')
        const headers: Record<string, string> = {}
        for (const header of request.apiKeyHeaders ?? ['authorization']) {
          headers[header] = header === 'authorization' ? `Bearer ${checked.value}` : checked.value
        }
        return { kind: 'api-key', endpoint, reference, headers }
      },
    }
  }

  /** The account sign-in the account service releases for the endpoint; absent without that service. */
  private account(endpoint: string): OmegaAuthCandidate {
    const { ctx } = this
    return {
      kind: 'account', endpoint,
      configured: async () => (await ctx.get('omegaAccount')?.resolveRequestCredential(endpoint)) !== undefined,
      resolve: async (signal) => {
        signal?.throwIfAborted()
        const credential = await ctx.get('omegaAccount')?.resolveRequestCredential(endpoint)
        if (credential === undefined) return undefined
        return {
          kind: 'account', endpoint, headers: credential.headers, revoked: credential.revoked,
          reject: () => credential.reject(),
        }
      },
    }
  }
}

export default OmegaAuth
