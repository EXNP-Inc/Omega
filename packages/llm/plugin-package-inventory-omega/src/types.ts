/** Wire types for the active Omega plugin package inventory. */

/** One exact active plugin package version. */
export interface OmegaPluginPackageIdentity {
  readonly name: string
  readonly version: string
}

/** Versioned full package inventory carried by each official Omega request. */
export interface OmegaPluginPackageInventoryExtension {
  readonly version: 1
  readonly packages: readonly OmegaPluginPackageIdentity[]
}

declare module '@omega-ai/dsh-omega-llm-api-extensions/types' {
  interface OmegaLlmApiExtensionMap {
    dsh_plugin_packages: OmegaPluginPackageInventoryExtension
  }
}
