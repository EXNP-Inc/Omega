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
  '@omega-ai/dsh-util-text-search',
  '@omega-ai/dsh-util-values',
]

/**
 * Runtime exports whose values remain valid when npm installs another package copy.
 * New entries are forbidden by default. Automated agents must not add an
 * exception; every addition requires explicit human review and a dedicated,
 * prominent heading in the pull request description.
 */
const SAFE_HOST_DEPENDENCY_EXPORTS = {
  '@omega-ai/dsh-atomic-write': ['withFileLock', 'writeFileAtomic'],
  '@omega-ai/dsh-deque': ['Deque'],
  // Builds a dispatcher from the resolved proxy policy; the caller owns and closes it.
  '@omega-ai/dsh-http-proxy': ['createRouteDispatcher'],
  // The Liveshare wire codec and identity helpers are stateless functions over caller-owned values.
  '@omega-ai/dsh-experimental-liveshare-protocol': [
    'LIVESHARE_CAPABILITIES', 'LIVESHARE_PROTOCOL_VERSION', 'parseRelayFrame', 'parseShareAccessState',
    'parseTunnelWorkerCommand', 'parseTunnelWorkerEvent', 'rawText', 'sendFrame', 'unsupportedFrameRefusal',
    'viewerRequestFields', 'identityFromKey', 'identityKeyOf',
  ],
  // The shipped profile templates are plain data; a consumer reads their bundle names only.
  '@omega-ai/dsh-official-bundles': ['PROFILE_TEMPLATES'],
  // Messages and assembled blocks are plain data. Each caller owns its assembler.
  '@omega-ai/dsh-llm': ['BlockAssembler', 'callConfigEquals', 'createUserMessage'],
  '@omega-ai/dsh-session-format': ['sessionFormatLogFilename'],
  '@omega-ai/dsh-storage-domain': ['defineDomain'],
  '@omega-ai/dsh-timeout': ['MAX_TIMER_DELAY_MS'],
  // Both operate only on the caller's subprocess service and handle; the module memoizes only the binary path.
  '@omega-ai/dsh-util-ripgrep': ['readRipgrepLines', 'spawnRipgrep'],
  '@omega-ai/schemastery': ['default'],
} as const satisfies HostDependencyExports

/** Runtime exports that require every consumer to resolve the provider's shared peer instance. */
const PEER_REQUIRED_HOST_EXPORTS = {
  // Profile settings must match the installed Node provider's configuration schema.
  '@omega-ai/dsh-ptc-runtime-node/configuration': ['resolvePersistentExecution'],
  // CUA mounts the installed provider and shares executor error classes with PTC.
  '@omega-ai/dsh-ptc-runtime-node': ['default'],
  '@omega-ai/dsh-tool-executor-ptc/run-code': ['RunCodeConfig', 'createRunCodeTool'],
  // CUA checks UserQuestionError and preserves AttachmentError from image admission; longEdgeDimensions is pure
  // arithmetic that rides the same peer.
  '@omega-ai/dsh-attachment': ['admitEncodedImages', 'longEdgeDimensions'],
  '@omega-ai/dsh-user-questions': ['UserQuestionError'],
  // The tool registry and every subclass rely on `instanceof` against one HarnessError class.
  '@omega-ai/dsh-error': ['HarnessError'],
  // `instanceof` checks need the translator's own class instance.
  '@omega-ai/dsh-experimental-translator': ['TranslationError'],
  // Stateless; a safe classification would turn the forge panel's forge and worktree peers into dependencies.
  '@omega-ai/dsh-experimental-forge': ['changeRequestKey'],
  '@omega-ai/dsh-experimental-worktree': ['generatedWorktreeName', 'CREATED_RECORD', 'createdWorktreeSchema'],
  // The forge panel matches ctx.fs failures with `instanceof FsError`.
  '@omega-ai/dsh-fs': ['FsError'],
  '@omega-ai/dsh-scope': ['carrierKeyOf', 'createScope', 'scopeOf', 'scopeParentOf', 'scopeTarget'],
  // appendPluginRecord writes through the Session class's private log; pluginRecordOf is stateless.
  // The Omega chat importer validates its seed with the installed Session class before storing it.
  '@omega-ai/dsh-session': ['SESSION_FORMAT_VERSION', 'Session', 'appendPluginRecord', 'pluginRecordOf'],
  '@omega-ai/dsh-session-persistence': ['SessionPersistenceNotFoundError'],
  // Imported titles follow the installed title service's normalization.
  '@omega-ai/dsh-session-title': ['normalizeSessionTitle'],
  // Error classes have instance identity; CUA and Liveshare throw the registry's own copy so `instanceof` against it matches.
  '@omega-ai/dsh-tools': ['defineTool', 'ToolArgsError', 'ToolContextUnavailableError'],
  // Readers recognize a deadline's TimeoutReason only by `instanceof` against their own copy.
  '@omega-ai/dsh-timeout': ['deadline', 'timeoutOf'],
  // Imported web tool results must render exactly like the installed web tools' results and cards.
  '@omega-ai/dsh-tool-web': ['fetchMetaFromValue', 'formatFetchOutput', 'formatSearchOutput', 'searchMetaFromValue'],
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
