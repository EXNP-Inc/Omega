/** Shared Host-persisted hardened-mode choice, projected to the browser. */
import z from '@omega-ai/schemastery'

/**
 * Settings namespace for the hardened-mode switch. It shares the `ui-settings`
 * namespace with the developer-tools preference, so a single settings document
 * section persists both switches.
 */
export const HARDENED_MODE_NAMESPACE = 'ui-settings'

/** The volatile field name of the hardened-mode switch in the shared namespace. */
export const HARDENED_MODE_FIELD = 'hardenedMode'

/** Persisted hardened-mode choice, as a field of the shared `ui-settings` namespace. */
export interface HardenedModeSettings {
  /**
   * Enable hardened mode: hides plugins, workspaces, file browsing, terminal,
   * feedback, and account features, and forces a single default workspace.
   */
  hardenedMode: boolean
}

/** New installations and missing values leave hardened mode off. */
export const HardenedModeSettingsFields = {
  hardenedMode: z.boolean().default(false),
}

/** Schema for the shared configuration field. */
export const HardenedModeSettingsSchema = z.object(HardenedModeSettingsFields)
