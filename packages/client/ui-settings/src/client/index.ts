/** Shared configuration forms and their Host describe mirror. */
import type { Context } from '@omega-ai/cordis'
import type { SyncedConfig, SyncedConfigRef } from '@omega-ai/dsh-client-config/types'
import type { UiSettingsConfig } from '../types.ts'
// Type-only: the ctx.remote merge and the carrier's `connection/reset`
// lifecycle event, all through the assembly package.
import type {} from '@omega-ai/dsh-api-remotes/client'
// Type-only pair supplying `$on` and its key face without dragging a build
// artifact into the Host graph (rationale beside the same pair in
// config-form.ts).
import type {} from '@omega-ai/dsh-api-remotes/types'
import type {} from '@omega-ai/dsh-settings/types'
import { SettingsSchemaService } from './schema.ts'
import { ConfigForms } from './config-form.ts'
import { SettingsDescribeMirror } from './settings-mirror.ts'

export type {
  SettingsLauncherOwnerProps, SettingsGeneralItemOwnerProps, SettingsHeaderOwnerProps, SettingsOnboardingOwnerProps,
  SettingsNoticeOwnerProps, SettingsSectionIconOwnerProps, SettingsSectionOwnerProps, SettingsSectionViewProps, SettingsTriggerOwnerProps,
} from './contract/slots.ts'
export type { ConfigForms } from './config-form.ts'
export type { ConfigForm, ConfigFormSnapshot } from './config-form-types.ts'
export type { SettingsSchemaService } from './schema.ts'
export type { SchemaNode } from './schema.ts'
export type {
  SettingsDescribeFace, SettingsDescribeView, SettingsMirrorSnapshot,
} from './settings-mirror.ts'

/**
 * Required services: the Remote namespace the mirror reads through and the
 * forwarded settings invalidation it refreshes on.
 */
export const inject = ['remote', 'remote.settings']

/**
 * A synced reference with no value: the hardened-mode preference reads it as
 * absent (`undefined`), which its observer projects to the default `false`. It
 * stands in for the loader-supplied reference in the tests that mount this
 * plugin through a bare `ctx.plugin` without a synced Config.
 */
const ABSENT_HARDENED_MODE_REF: SyncedConfigRef<boolean | undefined> = {
  get: () => undefined,
  getSnapshot: () => undefined,
  subscribe: () => () => {},
}

/** One hour in milliseconds, the granularity at which the server's unlock fact expires. */
const HOUR_MS = 3_600_000

/**
 * Milliseconds from `now` until the next UTC hour boundary. The settings gate
 * re-locks a peer's writes there, so the mirror re-reads at that instant to
 * refresh its `locked` flag (a client-side mirror of the server's fact expiry).
 * @param now - the current epoch milliseconds.
 * @returns the whole milliseconds until the next UTC hour boundary.
 */
function msToNextUtcHourBoundary(now: number): number {
  return Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS - now
}

/** Provide shared forms and refresh them on document changes and reconnects.
 * @param ctx Client provider context.
 * @param config This plugin's synced volatile Config, whose `hardenedMode`
 *   reference reads the persisted value the Host projects to the owner. It is
 *   absent from a bare `ctx.plugin` mount, where the reference reads `undefined`
 *   and the preference defaults to off.
 */
export function apply(ctx: Context, config?: SyncedConfig<UiSettingsConfig>): void {
  const schema = new SettingsSchemaService(ctx)
  // Persistence policy: every authenticated browser persists through the Host document
  // (.agents/notes/implemented/bug-fix/2026-09-15-authenticated-browser-host-preferences.md).
  const mirror = new SettingsDescribeMirror(ctx)
  ctx.effect(() => {
    const disposers = [
      ctx.remote.$on('settings/document-updated', () => { void mirror.load() }),
      ctx.on('connection/reset', () => { void mirror.load() }),
    ]
    // The first connection also emits connection/reset, so startup normally
    // costs two reads (budgeted in startup-rpc-budget.e2e.ts). The in-flight
    // fold does not merge them into one; it guarantees at most one pending
    // read at a time and that no invalidation arriving mid-read is lost.
    void mirror.ensure()
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-settings: describe mirror invalidations')
  // The settings gate re-locks a peer's writes at each UTC hour boundary, but
  // no `settings/document-updated` invalidation fires there. Re-read on that
  // schedule so the mirror's `locked` flag stays the gate's current word
  // instead of the last settled read's; one read per hour, rescheduled each
  // fire.
  ctx.effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      timer = setTimeout(() => {
        void mirror.load()
        arm()
      }, msToNextUtcHourBoundary(Date.now()))
    }
    arm()
    return () => { if (timer !== undefined) clearTimeout(timer) }
  }, 'ui-settings: describe mirror hour-boundary re-arm')
  new ConfigForms(ctx, { mirror, schema, hardenedModeRef: config?.hardenedMode ?? ABSENT_HARDENED_MODE_REF })
}
