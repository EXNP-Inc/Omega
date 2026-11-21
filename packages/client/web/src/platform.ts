/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 * @module @omega-ai/dsh-client-web/src/platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@omega-ai/cordis',
  'zod', '@tanstack/react-virtual',
  '@omega-ai/dsh-client-store',
  '@omega-ai/dsh-client-ui-slots',
  '@omega-ai/dsh-client-ui-primitives',
  '@omega-ai/dsh-client-ui-dockkit',
] as const

/**
 * Named export carrying the module manifest of a `staticLinked` library. The library keeps its ordinary
 * exports; the manifest's factory returns those exports, without this one, and its `meta` describes the
 * library's compiled stylesheets.
 */
export const STATIC_MODULE_MANIFEST_EXPORT = '__$dsh_client_module_manifest'

/** Client-bundle specifiers whose factories the parser preloads before the shell starts. */
export const PRELOADED_CLIENT_EXTERNALS = [
] as const

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof PLATFORM_MODULES)[number]
