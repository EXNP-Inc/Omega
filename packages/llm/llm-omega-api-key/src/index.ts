/** API-key authentication and discovery for the official Omega route. */
import type { Context } from '@omega-ai/cordis'
import { assertUsableApiKey, LlmError } from '@omega-ai/dsh-llm'
import type {} from '@omega-ai/cordis-plugin-loader'
import { launchEnvironmentOf } from '@omega-ai/dsh-launch-environment'
import { registerOmegaProvider, catalogModelInfo } from '@omega-ai/dsh-llm-omega'
import { Config, plainOptions, resolveAdapterOptions } from './config.ts'
import type { ResolvedOmegaOptions } from './config.ts'

export { Config, plainOptions, resolveAdapterOptions } from './config.ts'
export type { Options, ResolvedOmegaOptions } from './config.ts'
export const name = 'llm-omega-api-key'
export const inject = ['llm']

const PROVIDER = 'omega-official'

export function apply(ctx: Context, config: Config): void {
  const options = () => resolveAdapterOptions(plainOptions(config), launchEnvironmentOf(ctx))
  options()
  const resolveApiKey = async (connection: ResolvedOmegaOptions): Promise<string> => {
    const ref = connection.apiKeyEnv
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined) return assertUsableApiKey(hit.value, 'llm-omega', ref)
    } else {
      const ambient = launchEnvironmentOf(ctx).get(ref)
      if (ambient !== undefined && ambient.value.length > 0) return assertUsableApiKey(ambient.value, 'llm-omega', ref)
    }
    throw new LlmError(
      `llm-omega: no API key for provider route "${PROVIDER}"; store ${ref} through the credentials`
      + ` service (the web Models page writes it), or export ${ref} in the launching environment`,
      'MISSING_CREDENTIAL',
    )
  }
  ctx.llm.registerConfigurableProviders([
    { provider: PROVIDER, displayName: 'Omega', settingsNs: ctx.fiber.entry?.options.id ?? name, settingsPath: [] },
  ])
  registerOmegaProvider(ctx, PROVIDER, {
    options, providerName: 'Omega',
    resolveAuth: async connection => ({ headers: { 'x-api-key': await resolveApiKey(connection) } }),
    discoverModels: (provider) => {
      const connection = options()
      return Promise.resolve(connection.models.map(model => catalogModelInfo(provider, model)))
    },
  })
}
