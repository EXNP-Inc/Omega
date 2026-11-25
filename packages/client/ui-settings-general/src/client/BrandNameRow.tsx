/** General Settings control for the white-label brand name. */
import { useState } from 'react'
import { Button, Input } from '@omega-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@omega-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@omega-ai/dsh-client-ui-slots'
import css from './BrandNameRow.module.css'

/** Accepted brand name and ordered mutation supplied by the settings owner. */
export interface BrandNameRowInjected {
  hooks: { brandName: ObservableSnapshot<string | undefined> }
  setBrandName(name: string): Promise<void>
}

/**
 * Render the brand-name field.
 * @param props - accepted name, writer, and localized copy.
 * @returns the General Settings row.
 */
export function BrandNameRow({ useBrandName, setBrandName, t }:
  PropsRuntime<'settings.general.item'> & PropsLocale<'settings'> & InjectFace<BrandNameRowInjected>) {
  // The committed name, or '' when unset, so an absent value shows an empty field.
  const value = useBrandName(name => name ?? '')
  // Unsaved text; null keeps the field tracking the committed value, so an
  // external change re-renders the field without local state to rebase.
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const text = draft ?? value
  const save = async (next: string): Promise<void> => {
    setFailed(false)
    setBusy(true)
    try {
      await setBrandName(next)
      setDraft(null)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const commit = (): void => {
    if (busy || draft === null || draft === value) return
    void save(draft)
  }
  return <div className={css.row}>
    <div>
      <div className={css.title}>{t('brandName.title')}</div>
      <div className={css.description}>{t('brandName.description')}</div>
      {failed && <div role="alert">{t('brandName.error')}</div>}
    </div>
    <div className={css.control}>
      <Input value={text} placeholder={t('brandName.placeholder')} aria-label={t('brandName.title')} disabled={busy}
        className={css.field as string}
        onChange={(event) => { setFailed(false); setDraft(event.currentTarget.value) }}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') commit() }} />
      {text !== '' && <Button variant="ghost" size="sm" disabled={busy} className={css.clear}
        aria-label={t('brandName.clear')}
        onClick={() => { void save('') }} />
      }
    </div>
  </div>
}
