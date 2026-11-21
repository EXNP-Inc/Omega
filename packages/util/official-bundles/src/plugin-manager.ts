/** The package names the plugin manager protects, hides, orders, or marks experimental. */

/**
 * Plugin packages the plugin manager refuses to disable or remove, because management itself needs them; a bundle that
 * contains one is read-only as well. Removing a name drops only this `management-required` refusal; the manager's own
 * entry, installation-carried bundles, and unaddressable rows stay protected by their own rules.
 */
export const PROTECTED_PLUGINS: ReadonlySet<string> = new Set([
  '@omega-ai/dsh-plugin-manager', '@omega-ai/cordis-plugin-loader',
  '@omega-ai/cordis-plugin-include', '@omega-ai/dsh-api-gateway',
  '@omega-ai/dsh-host-webserver', '@omega-ai/dsh-client-modules',
  '@omega-ai/dsh-client-ui-plugin-manager',
  '@omega-ai/dsh-host-plugin-inventory', '@omega-ai/dsh-typert-registry',
  '@omega-ai/dsh-api-remotes', '@omega-ai/dsh-api-remote-access',
  '@omega-ai/cordis-plugin-timer', '@omega-ai/dsh-client-connection',
  '@omega-ai/dsh-host-frontend-static', '@omega-ai/dsh-tools',
  '@omega-ai/dsh-hmr',
])

/**
 * Built-in profile bundles, the standalone worktree tool, and the Computer Use MCP profile
 * bundle, which have no plugin manager page.
 * Their Host availability and activation stay intact.
 */
export const HIDDEN_BUNDLES: ReadonlySet<string> = new Set([
  '@omega-ai/dsh-base',
  '@omega-ai/dsh-web-app',
  '@omega-ai/dsh-headless',
  '@omega-ai/dsh-sdk-app',
  '@omega-ai/dsh-acp-app',
  '@omega-ai/dsh-sdk-minimal',
  '@omega-ai/dsh-experimental-tool-worktree',
  '@omega-ai/dsh-cua-mcp',
])

/**
 * The optional bundles the plugin manager's main and More lists rank first, in this order. {@link MORE_BUNDLES}, not
 * this list, decides whether a bundle appears on the main list.
 */
export const EXTENSION_BUNDLES: readonly string[] = [
  '@omega-ai/dsh-experimental-voice-input-bundle',
  '@omega-ai/dsh-experimental-plugin-market-bundle',
  '@omega-ai/dsh-experimental-auto-review',
]

/**
 * The optional bundles the plugin manager's main list leaves out until the profile enables them; its More list,
 * which includes every eligible bundle, ranks them last in this order.
 */
export const MORE_BUNDLES: readonly string[] = [
  '@omega-ai/dsh-personalized-recommendations',
  '@omega-ai/dsh-experimental-inspector-profile',
  '@omega-ai/dsh-cua-bundle',
  '@omega-ai/dsh-timeline',
  '@omega-ai/dsh-experimental-terminal-bundle',
  '@omega-ai/dsh-experimental-cot-translation-bundle',
  '@omega-ai/dsh-experimental-session-search',
  '@omega-ai/dsh-experimental-session-titles-bundle',
  '@omega-ai/dsh-experimental-badge-skill-bundle',
  '@omega-ai/dsh-experimental-ralph-bundle',
  '@omega-ai/dsh-omega-chat-import',
  '@omega-ai/dsh-subagent-codex',
  '@omega-ai/dsh-subagent-claude-code',
]

/** Official bundles the plugin manager marks with the Experimental badge. */
export const EXPERIMENTAL_BUNDLES: ReadonlySet<string> = new Set([
  '@omega-ai/dsh-personalized-recommendations',
  '@omega-ai/dsh-cua-bundle',
  '@omega-ai/dsh-cua-mcp',
  '@omega-ai/dsh-timeline',
  '@omega-ai/dsh-experimental-terminal-bundle',
  '@omega-ai/dsh-experimental-voice-input-bundle',
  '@omega-ai/dsh-experimental-auto-review',
  '@omega-ai/dsh-experimental-inspector-profile',
  '@omega-ai/dsh-experimental-forge-bundle',
  '@omega-ai/dsh-experimental-tool-worktree',
  '@omega-ai/dsh-experimental-cot-translation-bundle',
  '@omega-ai/dsh-experimental-session-search',
  '@omega-ai/dsh-experimental-session-titles-bundle',
  '@omega-ai/dsh-experimental-badge-skill-bundle',
  '@omega-ai/dsh-experimental-ralph-bundle',
  '@omega-ai/dsh-experimental-plugin-market-bundle',
  '@omega-ai/dsh-experimental-liveshare',
  '@omega-ai/dsh-omega-chat-import',
])
