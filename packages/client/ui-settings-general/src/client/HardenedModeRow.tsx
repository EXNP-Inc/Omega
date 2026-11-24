/** General Settings control for the shared hardened-mode toggle. */
import { useState } from 'react'
import { Switch } from '@omega-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@omega-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@omega-ai/dsh-client-ui-slots'
import css from './HardenedModeRow.module.css'

/** Accepted setting and ordered mutation supplied by the settings owner. */
export interface HardenedModeRowInjected {
  hooks: { hardenedMode: ObservableSnapshot<boolean> }
  setHardenedMode(enabled: boolean): Promise<void>
}

/**
 * Render the hardened-mode toggle.
 * @param props - accepted preference, writer and localized copy.
 * @returns the General Settings row.
 */
export function HardenedModeRow({ useHardenedMode, setHardenedMode, t }:
  PropsRuntime<'settings.general.item'> & PropsLocale<'settings'> & InjectFace<HardenedModeRowInjected>) {
  const enabled = useHardenedMode(value => value)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return <div className={css.row}>
    <div>
      <div className={css.title}>{t('hardenedMode.title')}</div>
      <div className={css.description}>{t('hardenedMode.description')}</div>
      {failed && <div role="alert">{t('hardenedMode.error')}</div>}
    </div>
    <Switch checked={enabled} disabled={busy} label={t('hardenedMode.title')}
      onChange={(next) => {
        setFailed(false)
        setBusy(true)
        void setHardenedMode(next).catch(() => { setFailed(true) }).finally(() => { setBusy(false) })
      }} />
  </div>
}
