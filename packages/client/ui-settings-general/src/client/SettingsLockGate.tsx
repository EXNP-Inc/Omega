/**
 * The settings unlock gate: shown in place of the settings panel while the
 * Host settings gate is locked for this peer. It owns the password field and
 * its busy/failed states; the gate itself and the hour-bound re-lock are
 * server-owned, so a refused attempt only clears the field and shows the
 * Host's single refusal.
 */
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, useModalLayer } from '@omega-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@omega-ai/dsh-client-ui-slots'
import css from './SettingsRoot.module.css'
import gate from './SettingsLockGate.module.css'

/** The injected unlock action and the dialog's close path, plus localized copy. */
export interface SettingsLockGateProps {
  /** Offer the entered password to the Host gate. */
  unlock: (password: string) => Promise<boolean>
  /** Close the settings panel (the gate reappears on the next open while locked). */
  onClose: () => void
  t: TranslateNS<'settings'>
}

/**
 * Render the unlock gate.
 * @param props - the unlock action, the close path, and the localized copy.
 * @returns the body-portaled gate dialog.
 */
export function SettingsLockGate({ unlock, onClose, t }: SettingsLockGateProps) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  useModalLayer(panel, true, onClose)

  const submit = async (): Promise<void> => {
    const value = password
    if (value === '' || busy) return
    setFailed(false)
    setBusy(true)
    const accepted = await unlock(value)
    setBusy(false)
    if (!accepted) {
      setPassword('')
      setFailed(true)
      return
    }
    // An accepted unlock clears the gate's locked fact; the shell re-renders
    // the normal panel. The field is reset so a later re-lock starts clean.
    setPassword('')
  }

  return createPortal((
    <div className={css.overlay} role="presentation">
      <div className={css.mask} aria-hidden="true" onClick={onClose} />
      <div ref={panel} tabIndex={-1} data-shortcut-modal="settings" className={gate.gate} role="dialog" aria-modal="true" aria-label={t('lockGate.title')}>
        <div className={gate.body}>
          <div className={gate.heading}>{t('lockGate.title')}</div>
          <div className={gate.description}>{t('lockGate.description')}</div>
          <form className={gate.form} onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <Input
              type="password"
              autoComplete="off"
              data-modal-autofocus
              value={password}
              placeholder={t('lockGate.placeholder')}
              onChange={(event) => { setPassword(event.target.value) }}
            />
            {failed && <div role="alert" className={gate.error}>{t('lockGate.error')}</div>}
            <div className={gate.actions}>
              <Button variant="ghost" disabled={busy} onClick={onClose}>{t('lockGate.close')}</Button>
              <Button variant="primary" type="submit" disabled={busy || password === ''}>{t('lockGate.submit')}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  ), document.body)
}
