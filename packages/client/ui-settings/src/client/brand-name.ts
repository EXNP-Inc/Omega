/** Shared white-label brand name: an ungated synced read and a Host-backed ordered write. */
import type { ObservableSnapshot } from '@omega-ai/dsh-client-store'
import type { SyncedConfigRef } from '@omega-ai/dsh-client-config/types'
import type { BrandSettings } from '../brand-settings.ts'
import { BRAND_FIELD } from '../brand-settings.ts'
import type { ConfigForm } from './config-form-types.ts'

/**
 * The white-label brand name shared by the sidebar, the window title, the
 * empty-session hero, and the settings row. Reads come from the browser's
 * synced Config reference, which the Host projects from the persisted value
 * before any settings unlock; writes go through the password-gated settings
 * form, like the hardened-mode preference. The snapshot keeps the stored
 * value verbatim — an absent or empty name reads as undefined, so every
 * surface falls back to its own localized product label.
 */
export class BrandNamePreference {
  /** Current brand name, or undefined when unset, observable through renderer-bound hooks. */
  readonly name: ObservableSnapshot<string | undefined>

  /**
   * @param read - the synced reference of the `brandName` volatile field,
   *   whose snapshot is the persisted value or undefined when the Host omits
   *   it.
   * @param scope - the settings-owned `ui-settings` form this preference
   *   writes through.
   */
  constructor(read: SyncedConfigRef<string | undefined>, private readonly scope: ConfigForm<BrandSettings>) {
    this.name = {
      getSnapshot: () => read.getSnapshot(),
      subscribe: (listener) => {
        let previous = this.name.getSnapshot()
        return read.subscribe(() => {
          const next = this.name.getSnapshot()
          if (next === previous) return
          previous = next
          listener()
        })
      },
    }
  }

  /**
   * Persist the choice on the Host with ordered writes; an empty name clears
   * the field, restoring the localized product label.
   * @param name - requested brand name, or '' to clear it.
   * @returns settlement after Host acceptance; rejects after a refused write recovers.
   */
  async set(name: string): Promise<void> {
    if (!await this.scope.set(BRAND_FIELD, name)) throw new Error('Brand name was not saved')
  }
}
