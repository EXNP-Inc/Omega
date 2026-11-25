/** The shared brand-name preference reads a synced value and writes it through the settings form. */
import type { SyncedConfigRef } from '@omega-ai/dsh-client-config/types'
import { stubConfigForm } from '@omega-ai/dsh-client-test-runtime'
import { describe, expect, it, vi } from 'vitest'
import { BRAND_FIELD, type BrandSettings } from '../src/brand-settings.ts'
import { BrandNamePreference } from '../src/client/brand-name.ts'

/** A controllable synced reference: fixed value, plus a setter and a bare notify for the equality guard. */
function refFixture(initial: string | undefined) {
  let value = initial
  const listeners = new Set<() => void>()
  const ref: SyncedConfigRef<string | undefined> = {
    get: () => value,
    getSnapshot: () => value,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
  const write = (next: string | undefined) => { value = next }
  const notify = () => { for (const listener of [...listeners]) listener() }
  return { ref, write, notify }
}

describe('brand name preference', () => {
  it('reads the stored value verbatim, undefined when the Host omits it', () => {
    const host = stubConfigForm<BrandSettings>()
    const { ref, write } = refFixture(undefined)
    const preference = new BrandNamePreference(ref, host.scope)
    expect(preference.name.getSnapshot()).toBeUndefined()
    write('Martino AI')
    expect(preference.name.getSnapshot()).toBe('Martino AI')
  })

  it('notifies observers on a changed value and not on a re-set of the same value', () => {
    const host = stubConfigForm<BrandSettings>()
    const { ref, write, notify } = refFixture(undefined)
    const preference = new BrandNamePreference(ref, host.scope)
    const changed = vi.fn()
    const dispose = preference.name.subscribe(changed)
    write('Martino AI')
    notify()
    expect(preference.name.getSnapshot()).toBe('Martino AI')
    expect(changed).toHaveBeenCalledTimes(1)
    // A Host re-set of the same value re-emits, but the value has not moved.
    notify()
    expect(changed).toHaveBeenCalledTimes(1)
    dispose()
    notify()
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('persists the name through the settings form and clears it on an empty value', async () => {
    const host = stubConfigForm<BrandSettings>()
    const { ref } = refFixture(undefined)
    const preference = new BrandNamePreference(ref, host.scope)
    await preference.set('Acme Support')
    expect(host.set).toHaveBeenLastCalledWith(BRAND_FIELD, 'Acme Support')
    await preference.set('')
    expect(host.set).toHaveBeenLastCalledWith(BRAND_FIELD, '')
    expect(host.set).toHaveBeenCalledTimes(2)
  })

  it('reports a refused Host write', async () => {
    const host = stubConfigForm<BrandSettings>()
    host.set.mockResolvedValue(false)
    const { ref } = refFixture(undefined)
    const preference = new BrandNamePreference(ref, host.scope)
    await expect(preference.set('Acme Support')).rejects.toThrow('Brand name was not saved')
    expect(host.set).toHaveBeenCalledWith(BRAND_FIELD, 'Acme Support')
  })
})
