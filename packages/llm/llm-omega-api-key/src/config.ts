/** API-key configuration resolved together with one Messages endpoint generation. */
import type { Volatile } from '@omega-ai/cordis'
import z from '@omega-ai/schemastery'
import { credentialRef, type CredentialRef } from '@omega-ai/dsh-credentials'
import type { LaunchEnvironmentSnapshot } from '@omega-ai/dsh-launch-environment'
import { omegaConfigFields, type Config as ProtocolConfig, plainOptions as protocolOptions, resolveAdapterOptions as resolveProtocolOptions } from '@omega-ai/dsh-llm-omega'
import type { Options as ProtocolOptions, OmegaConnectionOptions } from '@omega-ai/dsh-llm-omega'

/** Messages configuration with a per-request API-key reference. */
export interface Config extends ProtocolConfig {
  /** Credential reference resolved per request; defaults to OMEGA_API_KEY. */
  apiKeyEnv: Volatile<string>
}
export const Config = z.object({
  ...omegaConfigFields,
  apiKeyEnv: z.string().role('credential-ref').default('OMEGA_API_KEY').volatile(),
})
/** Plain deployment inputs for the API-key provider. */
export type Options = ProtocolOptions & { apiKeyEnv?: string }
/** Endpoint and credential reference captured from the same configuration generation. */
export interface ResolvedOmegaOptions extends OmegaConnectionOptions {
  /** Credential reference used only for this connection snapshot. */
  apiKeyEnv: CredentialRef
}
/** Read one validated provider configuration.
 * @param config - live plugin configuration.
 * @returns detached resolver inputs.
 */
export function plainOptions(config: Config): Options {
  return { ...protocolOptions(config), apiKeyEnv: config.apiKeyEnv.get() }
}
/** Resolve API-key and protocol settings together.
 * @param config - raw deployment settings.
 * @param environment - application launch environment.
 * @returns validated endpoint facts and the matching credential reference.
 */
export function resolveAdapterOptions(config: Options, environment?: LaunchEnvironmentSnapshot): ResolvedOmegaOptions {
  return { ...resolveProtocolOptions(config, environment), apiKeyEnv: credentialRef(config.apiKeyEnv ?? 'OMEGA_API_KEY') }
}
