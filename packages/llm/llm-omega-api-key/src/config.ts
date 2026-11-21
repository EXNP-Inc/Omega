/** API-key configuration resolved together with one Messages endpoint generation and its model listing. */
import type { Volatile } from '@omega-ai/cordis'
import z from '@omega-ai/schemastery'
import { credentialRef, type CredentialRef } from '@omega-ai/dsh-credentials'
import type { LaunchEnvironmentSnapshot } from '@omega-ai/dsh-launch-environment'
import {
  omegaConfigFields, isBuiltInCatalog, modelListingConfigFields, modelListingURL, plainOptions as protocolOptions, PUBLIC_BASE_URL,
  resolveAdapterOptions as resolveProtocolOptions, resolveListingTiming,
} from '@omega-ai/dsh-llm-omega'
import type {
  Config as ProtocolConfig, OmegaConnectionOptions, ListingSettings, ModelListingConfig, ModelListingOptions, Options as ProtocolOptions,
} from '@omega-ai/dsh-llm-omega'

/** Origin of the official API, the only endpoint whose `/models` listing this route follows. */
const OFFICIAL_ORIGIN = new URL(PUBLIC_BASE_URL).origin

/** Messages configuration with a per-request API-key reference. */
export interface Config extends ProtocolConfig, ModelListingConfig {
  /** Credential reference resolved per request; defaults to OMEGA_API_KEY. */
  apiKeyEnv: Volatile<string>
}
export const Config = z.object({
  ...omegaConfigFields,
  ...modelListingConfigFields,
  apiKeyEnv: z.string().role('credential-ref').default('OMEGA_API_KEY').volatile(),
})
/** Plain deployment inputs for the API-key provider. */
export type Options = ProtocolOptions & ModelListingOptions & { apiKeyEnv?: string }
/** Endpoint and credential reference captured from the same configuration generation. */
export interface ResolvedOmegaOptions extends OmegaConnectionOptions {
  /** Credential reference used only for this connection snapshot. */
  apiKeyEnv: CredentialRef
  /**
   * The official `/models` listing this generation follows; absent when `models`
   * differs from the built-in catalog or the endpoint is not the official API.
   */
  listing?: ListingSettings
}
/** Read one validated provider configuration.
 * @param config - live plugin configuration.
 * @returns detached resolver inputs.
 */
export function plainOptions(config: Config): Options {
  return { ...protocolOptions(config), apiKeyEnv: config.apiKeyEnv.get() }
}
/** Resolve API-key, listing, and protocol settings together.
 * @param config - raw deployment settings.
 * @param environment - application launch environment.
 * @returns validated endpoint facts, the matching credential reference, and the listing the catalog follows.
 */
export function resolveAdapterOptions(config: Options, environment?: LaunchEnvironmentSnapshot): ResolvedOmegaOptions {
  const { modelsTimeoutMs: _timeout, modelsMaxAgeMs: _maxAge, apiKeyEnv, ...messages } = config
  const timing = resolveListingTiming(config, 'llm-omega-api-key')
  const connection = resolveProtocolOptions(messages, environment)
  const listed = new URL(connection.baseURL).origin === OFFICIAL_ORIGIN && isBuiltInCatalog(connection.models)
  return {
    ...connection,
    apiKeyEnv: credentialRef(apiKeyEnv ?? 'OMEGA_API_KEY'),
    ...listed ? { listing: { url: modelListingURL(connection.baseURL), ...timing } } : {},
  }
}
