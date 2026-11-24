/** Shared hardened-mode preference: an ungated synced read and a Host-backed ordered write. */
import type { ObservableSnapshot } from '@omega-ai/dsh-client-store'
import type { SyncedConfigRef } from '@omega-ai/dsh-client-config/types'
import type { HardenedModeSettings } from '../hardened-settings.ts'
import { HARDENED_MODE_FIELD } from '../hardened-settings.ts'
import type { ConfigForm } from './config-form-types.ts'

/**
 * The hardened-mode preference shared by every gated surface and the settings
 * toggle. Reads come from the browser's synced Config reference, which the Host
 * projects from the persisted value before any settings unlock; writes go
 * through the password-gated settings form, like the developer-tool
 * preference. Surfaces therefore hide their features from the first render
 * even when settings are still locked.
 */
export class HardenedModePreference {
  /** Current hardened state, observable through renderer-bound hooks. */
  readonly enabled: ObservableSnapshot<boolean>

  /**
   * @param read - the synced reference of the `hardenedMode` volatile field,
   *   whose snapshot is the persisted value or undefined when the Host omits
   *   it.
   * @param scope - the settings-owned `ui-settings` form this preference
   *   writes through.
   */
  constructor(read: SyncedConfigRef<boolean | undefined>, private readonly scope: ConfigForm<HardenedModeSettings>) {
    this.enabled = {
      getSnapshot: () => read.getSnapshot() ?? false,
      subscribe: (listener) => {
        let previous = this.enabled.getSnapshot()
        return read.subscribe(() => {
          const next = this.enabled.getSnapshot()
          if (next === previous) return
          previous = next
          listener()
        })
      },
    }
  }

  /**
   * Persist the choice on the Host with ordered writes.
   * @param enabled - requested hardened mode.
   * @returns settlement after Host acceptance; rejects after a refused write recovers.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (!await this.scope.set(HARDENED_MODE_FIELD, enabled)) throw new Error('Hardened mode preference was not saved')
  }
}
