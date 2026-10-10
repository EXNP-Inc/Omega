/** Account-token authentication and discovery for the Omega account route. */
import type {} from '@omega-ai/cordis-plugin-loader'
import type { Context } from '@omega-ai/cordis'
import { ACCOUNT_QUOTA_EXCEEDED_CODE, LlmError, QUOTA_EXCEEDED_CODE } from '@omega-ai/dsh-llm'
import type {} from '@omega-ai/dsh-omega-account'
import { launchEnvironmentOf } from '@omega-ai/dsh-launch-environment'
import { plainOptions, resolveAdapterOptions, registerOmegaProvider, catalogModelInfo } from '@omega-ai/dsh-llm-omega'
import type { OmegaRequestAuth, ResolvedOmegaOptions } from '@omega-ai/dsh-llm-omega'

import { Config } from './config.ts'
export { Config } from './config.ts'
export const name = 'llm-omega-account'
export const inject = ['llm']

const PROVIDER = 'omega-account'

export function apply(ctx: Context, config: Config): void {
  const options = () => resolveAdapterOptions(plainOptions(config), launchEnvironmentOf(ctx))
  options()
  const resolveAuth = async (connection: ResolvedOmegaOptions): Promise<OmegaRequestAuth> => {
    const account = ctx.get('omegaAccount')
    const token = await account?.resolveToken(connection.baseURL)
    if (token === undefined) throw new LlmError('Sign in to Omega to use the account provider. The request destination must allow account authentication.', 'ACCOUNT_SIGN_IN_REQUIRED')
    return {
      headers: { 'x-dsh-auth-token': token },
      onRequestError: async (error) => {
        if (!(error instanceof LlmError)) return error
        if (error.code === QUOTA_EXCEEDED_CODE) {
          return new LlmError(error.message, ACCOUNT_QUOTA_EXCEEDED_CODE, { ...error.failure, cause: error })
        }
        if (error.failure.status !== 401) return error
        const rejected = new LlmError(error.message, 'ACCOUNT_TOKEN_INVALID', { ...error.failure, cause: error })
        try { await account?.rejectToken(token) }
        catch (_credentialRemovalFailed) { /* Storage failure cannot replace the inference failure. */ }
        return rejected
      },
    }
  }
  ctx.llm.registerConfigurableProviders([
    { provider: PROVIDER, displayName: 'Omega Account', settingsNs: ctx.fiber.entry?.options.id ?? name, settingsPath: [] },
  ])
  registerOmegaProvider(ctx, PROVIDER, {
    options, resolveAuth, providerName: 'Omega Account',
    discoverModels: async (provider) => {
      const connection = options()
      try { await resolveAuth(connection) }
      catch (error) {
        if (error instanceof LlmError && error.code === 'ACCOUNT_SIGN_IN_REQUIRED') return []
        throw error
      }
      return connection.models.map(model => catalogModelInfo(provider, model))
    },
  })
}
