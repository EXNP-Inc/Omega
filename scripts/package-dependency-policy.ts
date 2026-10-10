/** Explicit exceptions and Host packages for the published dependency policy. */

/** Packages treated as Client/Host packages without declaring `dsh.client`. */
const CLIENT_FACE_INCLUDE: readonly string[] = []

/** Packages exempted from automatic Client/Host treatment despite declaring `dsh.client`. */
const CLIENT_FACE_EXCLUDE: readonly string[] = [
  '@omega-ai/dsh-api-session-controller',
  '@omega-ai/dsh-api-workspace-controller',
]

/** Host-only packages whose peer relays are deliberately flattened. */
const HOST_DEPENDENCY_PACKAGES: readonly string[] = [
  '@omega-ai/dsh-llm',
  '@omega-ai/dsh-session',
]

/** Required Cordis services whose Host imports are type-only. */
const REQUIRED_SERVICE_PEERS = {
  '@omega-ai/dsh-api-terminal-controller': ['@omega-ai/dsh-subprocess'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Development-only package relationships not represented by source imports. */
const CONFIGURATION_ONLY_DEV_DEPENDENCIES = {
  '@omega-ai/dsh-client-locale': ['@omega-ai/dsh-api-remotes'],
  '@omega-ai/dsh-client-ui-conversation': [
    '@omega-ai/dsh-api-remotes',
    '@omega-ai/dsh-client-ui-workspace',
  ],
  '@omega-ai/dsh-client-ui-model-selection': ['@omega-ai/dsh-client-ui-input-trigger'],
  '@omega-ai/dsh-client-ui-sidebar': ['@omega-ai/dsh-client-ui-workspace'],
  '@omega-ai/dsh-client-ui-subagent': ['@omega-ai/dsh-client-ui-input-trigger'],
  '@omega-ai/dsh-client-ui-theme': ['@omega-ai/dsh-api-remotes'],
  '@omega-ai/dsh-client-ui-tool': ['@omega-ai/dsh-api-remotes'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Workspace packages whose complete runtime surface is safe across duplicate installations. */
const DUPLICATE_SAFE_PACKAGES: readonly string[] = [
  '@omega-ai/dsh-brand',
  '@omega-ai/dsh-lazy-require',
  '@omega-ai/dsh-typert-protocol',
  '@omega-ai/dsh-util-code-language',
  '@omega-ai/dsh-util-crypto',
  '@omega-ai/dsh-util-values',
]

/**
 * Runtime exports whose values remain valid when npm installs another package copy.
 * New entries are forbidden by default. Automated agents must not add an
 * exception; every addition requires explicit human review and a dedicated,
 * prominent heading in the pull request description.
 */
const SAFE_HOST_DEPENDENCY_EXPORTS = {
  '@omega-ai/dsh-credentials': ['credentialKey'],
  '@omega-ai/dsh-deque': ['Deque'],
  '@omega-ai/dsh-llm': ['callConfigEquals'],
  '@omega-ai/dsh-session-format': ['sessionFormatLogFilename'],
  '@omega-ai/dsh-timeout': ['MAX_TIMER_DELAY_MS'],
  '@omega-ai/schemastery': ['default'],
} as const satisfies HostDependencyExports

/** Runtime exports that require every consumer to resolve the provider's shared peer instance. */
const PEER_REQUIRED_HOST_EXPORTS = {
  '@omega-ai/dsh-client-connection': ['OperatorPeer'],
  '@omega-ai/dsh-scope': ['carrierKeyOf', 'createScope', 'scopeOf', 'scopeTarget'],
  '@omega-ai/dsh-session': ['SESSION_FORMAT_VERSION'],
  '@omega-ai/dsh-session-persistence': ['SessionPersistenceNotFoundError'],
} as const satisfies HostDependencyExports

/** Exact import specifier to reviewed runtime exports. */
type HostDependencyExports = Readonly<Record<string, readonly string[]>>

/** Complete configurable input to package dependency classification. */
export interface PackageDependencyPolicy {
  readonly clientFaceInclude: readonly string[]
  readonly clientFaceExclude: readonly string[]
  readonly hostPackages: readonly string[]
  readonly requiredServicePeers?: Readonly<Record<string, readonly string[]>>
  readonly configurationOnlyDevDependencies: Readonly<Record<string, readonly string[]>>
  readonly duplicateSafePackages?: readonly string[]
  readonly safeHostDependencyExports: HostDependencyExports
  readonly peerRequiredHostExports: HostDependencyExports
}

/** Repository dependency policy consumed by verification and benchmarking. */
export const PACKAGE_DEPENDENCY_POLICY: PackageDependencyPolicy = {
  clientFaceInclude: CLIENT_FACE_INCLUDE,
  clientFaceExclude: CLIENT_FACE_EXCLUDE,
  hostPackages: HOST_DEPENDENCY_PACKAGES,
  requiredServicePeers: REQUIRED_SERVICE_PEERS,
  configurationOnlyDevDependencies: CONFIGURATION_ONLY_DEV_DEPENDENCIES,
  duplicateSafePackages: DUPLICATE_SAFE_PACKAGES,
  safeHostDependencyExports: SAFE_HOST_DEPENDENCY_EXPORTS,
  peerRequiredHostExports: PEER_REQUIRED_HOST_EXPORTS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a package manifest declares a dynamically loaded Client entry. */
export function hasClientDeclaration(dshField: unknown): boolean {
  return isRecord(dshField) && Object.hasOwn(dshField, 'client')
}

/** Whether the repository policy flattens one package's non-Cordis peers. */
export function usesFlattenedPackageDependencies(
  manifestPath: string,
  packageName: string,
  dshField: unknown,
  policy: PackageDependencyPolicy = PACKAGE_DEPENDENCY_POLICY,
): boolean {
  if (!manifestPath.startsWith('packages/') || manifestPath.startsWith('packages/experimental/')) return false
  if (policy.hostPackages.includes(packageName)) return true
  if (manifestPath.startsWith('packages/client/')) return true
  const included = hasClientDeclaration(dshField) || policy.clientFaceInclude.includes(packageName)
  return included && !policy.clientFaceExclude.includes(packageName)
}
