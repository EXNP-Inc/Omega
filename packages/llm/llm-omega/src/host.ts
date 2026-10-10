/** Shared Host wiring for the Omega protocol adapter. */
import type { Context } from '@omega-ai/cordis'
import type {} from '@omega-ai/dsh-settings'
import type {} from '@omega-ai/cordis-plugin-loader'
import type {} from '@omega-ai/dsh-fs'
import { resolveImageAttachmentAccess } from '@omega-ai/dsh-llm'
import { getOrCreateAnonymousUserId, type AnonymousUserId } from '@omega-ai/dsh-anonymous-user-id'
import { deepEqualJson } from '@omega-ai/dsh-util-values'
import { OmegaAdapter } from './adapter.ts'
import type { OmegaAdapterOptions, OmegaConnectionOptions } from './types.ts'

/**
 * Register one provider with request-local transport services and live retry policy.
 * @param ctx - provider plugin lifetime with the LLM registry injected.
 * @param provider - exact route owned by this plugin.
 * @param dependencies - provider-owned discovery, credential, and configuration callbacks.
 */
export function registerOmegaProvider<C extends OmegaConnectionOptions>(
  ctx: Context, provider: string, dependencies: Pick<OmegaAdapterOptions<C>,
  'options' | 'resolveAuth' | 'providerName' | 'discoverModels'>): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  let userId: AnonymousUserId | undefined
  const adapter = new OmegaAdapter({
    ...dependencies,
    resolveUserId: () => userId ??= getOrCreateAnonymousUserId(),
    onReplayDegrade: ({ provider, model, reason }) => {
      ctx.logger.warn(`llm-omega: unusable Messages replay state on assistant history for route "${provider}/${model}"; sending provider-neutral content (${reason})`)
    },
    onExtensionsOmitted: ({ provider, model, fields, error }) => {
      ctx.logger.warn(`llm-omega: sending route "${provider}/${model}" without request extension fields ${fields.join(', ')} because they failed to serialize: %o`, error)
    },
    resolveAttachments: () => ctx.get('attachments'),
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
      attachments, hostPath => ctx.get('fs')?.processPathFromHostPath(hostPath), ref,
    ),
    prepareExtensions: request => ctx.get('omegaLlmApiExtensions')?.prepare(request)
      ?? Promise.resolve({ fields: {}, accept: () => Promise.resolve() }),
  })
  const registration = ctx.llm.registerAdapter([provider], adapter)
  let registeredPolicy = dependencies.options().retryPolicy
  ctx.on('loader/volatile-update', () => {
    let policy: typeof registeredPolicy
    try { policy = dependencies.options().retryPolicy }
    catch (error) { ctx.logger.warn(error); return }
    if (deepEqualJson(policy, registeredPolicy)) return
    registration.replace([provider])
    registeredPolicy = policy
  })
}
