/** The bundle package names the dsh installation selects, offers, installs on demand, or retires. */

/** Installation-owned defaults used when a shipped profile is first opened. */
export interface ProfileTemplate {
  /** Ordered bundle layer list. */
  bundles: readonly string[]
}

/** The shipped profile templates auto-initialized on first use, by name. */
export const PROFILE_TEMPLATES: Record<string, ProfileTemplate> = {
  acp: {
    bundles: ['@omega-ai/dsh-base', '@omega-ai/dsh-acp-app'],
  },
  web: {
    bundles: ['@omega-ai/dsh-base', '@omega-ai/dsh-web-app'],
  },
  headless: {
    bundles: ['@omega-ai/dsh-base', '@omega-ai/dsh-headless'],
  },
  sdk: {
    bundles: ['@omega-ai/dsh-base', '@omega-ai/dsh-sdk-app'],
  },
  'sdk-minimal': {
    bundles: ['@omega-ai/dsh-sdk-minimal'],
  },
}

/**
 * Installation-owned bundle tuples that an earlier release wrote into a shipped profile; app-boot replaces an exact
 * match with the {@link PROFILE_TEMPLATES} entry of the same name and leaves every other list untouched.
 */
export const INSTALLATION_OWNED_PROFILE_TUPLES: Readonly<Record<string, readonly string[]>> = {
  headless: ['@omega-ai/dsh-base', '@omega-ai/dsh-web-app', '@omega-ai/dsh-headless'],
}

/** Bundles an earlier release shipped and the installation no longer carries; app-boot removes them from profiles. */
export const RETIRED_BUNDLES: ReadonlySet<string> = new Set([
  // The Web composition mounts Schedule itself
  // ([upgrade guide](../../../../docs/upgrade-guide/v0.2.0-rc.2/schedule-bundle-retired/guide.md)).
  '@omega-ai/dsh-experimental-schedule-bundle',
  '@omega-ai/dsh-experimental-agent-team-profile',
])

/** The bundle list a `dsh plugin` init uses for a name with no shipped template. */
export const DEFAULT_PROFILE_BUNDLES: readonly string[] = ['@omega-ai/dsh-base']

/**
 * The bundles the dsh installation ships for a person to switch on: each a
 * runtime dependency of the installation that declares `dsh.bundle.patch`,
 * an `icon`, and `./locale/*.json` display metadata, selected by no shipped
 * template, and offered switched off by the plugin manager when listed
 * ([rationale](../../../../.agents/notes/implemented/process/2026-09-15-shipped-optional-bundles.md),
 * [admission](../../../../.agents/notes/implemented/architecture/2026-09-21-experimental-capabilities-as-optional-bundles.md)).
 */
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@omega-ai/dsh-personalized-recommendations',
  '@omega-ai/dsh-cua-bundle',
  '@omega-ai/dsh-cua-mcp',
  '@omega-ai/dsh-timeline',
  '@omega-ai/dsh-experimental-session-search',
  '@omega-ai/dsh-experimental-ralph-bundle',
  '@omega-ai/dsh-experimental-terminal-bundle',
  '@omega-ai/dsh-experimental-badge-skill-bundle',
  '@omega-ai/dsh-experimental-session-titles-bundle',
  '@omega-ai/dsh-experimental-voice-input-bundle',
  '@omega-ai/dsh-experimental-cot-translation-bundle',
  '@omega-ai/dsh-experimental-auto-review',
  '@omega-ai/dsh-experimental-inspector-profile',
  '@omega-ai/dsh-experimental-liveshare',
  '@omega-ai/dsh-experimental-plugin-market-bundle',
  '@omega-ai/dsh-experimental-tool-worktree',
  '@omega-ai/dsh-experimental-forge-bundle',
  '@omega-ai/dsh-omega-chat-import',
]

/** Public DSH release members available through the ordinary on-demand bundle installer. */
export const ON_DEMAND_BUNDLES: readonly string[] = [
  '@omega-ai/dsh-subagent-claude-code',
  '@omega-ai/dsh-subagent-codex',
]
