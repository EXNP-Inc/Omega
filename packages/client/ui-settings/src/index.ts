/** Host registration of shared Web and desktop developer-tool preferences. */
import type {} from '@omega-ai/dsh-settings'

import type { Context } from '@omega-ai/cordis'

import z from '@omega-ai/schemastery'
import { DeveloperToolsSettingsFields } from './developer-tools-settings.ts'
import { HardenedModeSettingsFields } from './hardened-settings.ts'
import type { UiSettingsConfig } from './types.ts'

/** Runtime preferences projected to the browser. */
export type Config = UiSettingsConfig

/** Live preferences projected to the browser. */
export const Config = z.object({
  enabled: DeveloperToolsSettingsFields['enabled'].volatile(),
  hardenedMode: HardenedModeSettingsFields['hardenedMode'].volatile(),
})

/** Host preferences are consumed through the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
