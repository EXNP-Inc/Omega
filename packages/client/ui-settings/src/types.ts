/** Shared configuration values persisted by the Host and projected to the browser. */
import type { Volatile } from '@omega-ai/cordis'

/**
 * The `ui-settings` configuration shared by the Host and Client faces; types only.
 * The Host persists both switches and the browser receives each volatile field
 * through its synced Config.
 */
export interface UiSettingsConfig {
  /** Whether developer tools are enabled. */
  enabled: Volatile<boolean>
  /**
   * Whether hardened mode is enabled: hides plugins, workspaces, file browsing,
   * terminal, feedback, and account features, and forces a single default
   * workspace.
   */
  hardenedMode: Volatile<boolean>
  /**
   * White-label brand name shown in the sidebar, window title, and empty
   * session hero. Absent (unset) when the localized product label should show
   * instead; an empty value reads as unset.
   */
  brandName: Volatile<string | undefined>
}
