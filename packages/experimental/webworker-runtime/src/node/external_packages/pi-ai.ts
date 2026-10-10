/**
 * `@earendil-works/pi-ai` stub, including its `/providers/all` and `/api/*.lazy`
 * subpaths. The package is Node-only (no `require`/`browser` conditions, Node
 * builtins plus five cloud SDKs in its transport layer) and `llm-pi-ai` imports it
 * statically at module scope, so the row cannot mount without it.
 *
 * Every symbol `llm-pi-ai` imports by name is present: a missing CommonJS symbol
 * would surface as `undefined` at call time instead of a link error. The three catalog readers
 * return empty collections rather than throwing — the row reads them while it
 * activates, and "this deployment ships no pi-ai provider" is the truth here.
 * The protocol factories construct silently for the same reason: `llm-pi-ai`
 * builds each configured route's provider while it activates, so a throwing
 * factory would turn every shipped pi-ai profile into a boot failure. Each
 * factory returns a stream object whose request-path methods refuse, so a
 * configured route mounts dormant and loudness lands on a request, where the
 * deployment is actually wrong.
 */
import { notImplementedFail } from '../notImplementedFail.ts'

const MODULE = '@earendil-works/pi-ai'

/**
 * A `ProviderStreams` whose request path refuses: construction succeeds so a
 * configured route can mount, and a stream attempt reports the unavailable
 * binding.
 * @param api - the protocol binding name for refusal messages.
 * @returns the inert stream object.
 */
function inertStreams(api: string): {
  readonly stream: unknown
  readonly streamSimple: unknown
} {
  return {
    stream: notImplementedFail(MODULE, `${api}.stream`),
    streamSimple: notImplementedFail(MODULE, `${api}.streamSimple`),
  }
}

/** Provider factory (unavailable). */
export const createProvider = notImplementedFail(MODULE, 'createProvider')

/** Model-list factory (unavailable). */
export const createModels = notImplementedFail(MODULE, 'createModels')

/** Thinking-level catalog (unavailable). */
export const getSupportedThinkingLevels = notImplementedFail(MODULE, 'getSupportedThinkingLevels')

/** Context-overflow predicate (unavailable). */
export const isContextOverflow = notImplementedFail(MODULE, 'isContextOverflow')

/** Builtin provider ids of pi-ai 0.84.2, in catalog order. */
const BUILTIN_PROVIDER_IDS: readonly string[] = [
  'amazon-bedrock', 'ant-ling', 'anthropic', 'azure-openai-responses', 'baseten', 'cerebras',
  'cloudflare-ai-gateway', 'cloudflare-workers-ai', 'omega', 'fireworks', 'github-copilot',
  'google', 'google-vertex', 'groq', 'huggingface', 'kimi-coding', 'minimax', 'minimax-cn',
  'mistral', 'moonshotai', 'moonshotai-cn', 'nvidia', 'openai', 'openai-codex', 'opencode',
  'opencode-go', 'openrouter', 'qwen-token-plan', 'qwen-token-plan-cn',
  'qwen-token-plan-individual', 'together',
  'vercel-ai-gateway', 'xai', 'xiaomi', 'xiaomi-token-plan-ams', 'xiaomi-token-plan-cn',
  'xiaomi-token-plan-sgp', 'zai', 'zai-coding-cn',
]

/**
 * Installed catalog providers, read while `llm-pi-ai` activates. Each carries the
 * api-key auth marker the adapter filters on, and no models: the provider
 * directory therefore matches the served deployment while every request path
 * lands on a loud symbol above.
 * @returns one entry per builtin provider.
 */
export function builtinProviders(): unknown[] {
  return BUILTIN_PROVIDER_IDS.map(id => ({
    id,
    name: id,
    auth: { apiKey: { type: 'api-key' } },
    models: [],
  }))
}

/**
 * Provider route ids of the installed catalog. `llm-pi-ai` registers the whole
 * catalog as configurable the moment it mounts and rejects an empty
 * registration, so these are pi-ai's real ids rather than an empty list.
 * @returns the builtin provider ids.
 */
export function getBuiltinProviders(): string[] {
  return [...BUILTIN_PROVIDER_IDS]
}

/**
 * Models of one installed catalog provider.
 * @returns no models.
 */
export function getBuiltinModels(): unknown[] {
  return []
}

/** A registered provider as far as the inert collection reads it. */
interface InertProvider {
  readonly id: string
  readonly getModels?: () => unknown[]
}

/**
 * A `MutableModels` collection for the worker host: configured routes register
 * and model queries read back what was registered, but the wire never exists.
 * `llm-pi-ai` builds this while it activates (clearing the catalog builtins
 * out of it), so it must construct and register silently; a stream attempt is
 * the request path, and that is where it refuses.
 * @returns the inert collection.
 */
export function builtinModels(): {
  clearProviders: () => void
  setProvider: (provider: InertProvider) => void
  getModels: (provider: string) => unknown[]
  getModel: (provider: string, model: string) => unknown
  streamSimple: unknown
} {
  const providers = new Map<string, InertProvider>()
  const modelsOf = (provider: string): unknown[] =>
    providers.get(provider)?.getModels?.() ?? []
  return {
    clearProviders: (): void => { providers.clear() },
    setProvider: (provider: InertProvider): void => { providers.set(provider.id, provider) },
    getModels: (provider: string): unknown[] => modelsOf(provider),
    getModel: (provider: string, model: string): unknown =>
      modelsOf(provider).find(candidate => (candidate as { readonly id?: unknown }).id === model) ?? undefined,
    streamSimple: notImplementedFail(MODULE, 'streamSimple'),
  }
}

/**
 * Anthropic messages API binding: constructs inert, refuses on a stream.
 * @returns the inert stream object.
 */
export const anthropicMessagesApi = (): { readonly stream: unknown; readonly streamSimple: unknown } =>
  inertStreams('anthropicMessagesApi')

/**
 * OpenAI completions API binding: constructs inert, refuses on a stream.
 * @returns the inert stream object.
 */
export const openAICompletionsApi = (): { readonly stream: unknown; readonly streamSimple: unknown } =>
  inertStreams('openAICompletionsApi')

/**
 * OpenAI responses API binding: constructs inert, refuses on a stream.
 * @returns the inert stream object.
 */
export const openAIResponsesApi = (): { readonly stream: unknown; readonly streamSimple: unknown } =>
  inertStreams('openAIResponsesApi')

/** CommonJS interop marker: the worker loader hands `default` to default imports. */
export const __esModule = true

/** CommonJS default export: the members `require()` hands a caller of this module. */
export default {
  createProvider, createModels, getSupportedThinkingLevels, isContextOverflow, builtinProviders,
  getBuiltinModels, getBuiltinProviders, builtinModels, anthropicMessagesApi, openAICompletionsApi,
  openAIResponsesApi,
}
