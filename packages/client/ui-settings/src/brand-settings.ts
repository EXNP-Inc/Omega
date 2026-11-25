/** Shared Host-persisted brand name, projected to the browser. */
import z from '@omega-ai/schemastery'

/**
 * Settings namespace for the white-label brand name. It shares the `ui-settings`
 * namespace with the developer-tools and hardened-mode preferences, so a single
 * settings document section persists all three values.
 */
export const BRAND_NAMESPACE = 'ui-settings'

/** The volatile field name of the brand name in the shared namespace. */
export const BRAND_FIELD = 'brandName'

/** Persisted brand name, as a field of the shared `ui-settings` namespace. */
export interface BrandSettings {
  /**
   * White-label brand name shown in the sidebar, window title, and empty
   * session hero. An absent value falls back to the localized product label.
   */
  brandName: string
}

/**
 * New installations and cleared values leave the brand name absent, so the
 * localized product label shows instead of an empty or default string.
 */
export const BrandSettingsFields = {
  brandName: z.string().required(false),
}

/** Schema for the shared configuration field. */
export const BrandSettingsSchema = z.object(BrandSettingsFields)
