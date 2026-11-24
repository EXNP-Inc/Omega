// @vitest-environment jsdom
/**
 * The settings unlock gate in isolation: password entry, its busy and failed
 * states, the Host's single refusal, and its close paths. The gate and the
 * hour-bound re-lock are server-owned; this component only offers the password
 * and clears its field, so an accepted answer simply hands the shell back.
 */
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsLockGate } from '../src/client/SettingsLockGate.tsx'
import { en } from '../src/client/locales.ts'
import { makeTranslate } from '@omega-ai/dsh-client-test-runtime'

const t = makeTranslate(en)
afterEach(cleanup)

function mount(unlock: (password: string) => Promise<boolean>) {
  const onClose = vi.fn()
  const view = render(<SettingsLockGate unlock={unlock} onClose={onClose} t={t} />)
  return { view, onClose }
}

it('presents the locked gate with the password field focused and the unlock disabled', () => {
  mount(vi.fn().mockResolvedValue(true))
  expect(screen.getByRole('dialog', { name: 'Settings are locked' })).toBeTruthy()
  expect(screen.getByText('Enter the current password to open settings. It changes every hour.')).toBeTruthy()
  const field = screen.getByPlaceholderText('Enter password')
  expect(document.activeElement).toBe(field)
  expect((screen.getByRole('button', { name: 'Unlock' }) as HTMLButtonElement).disabled).toBe(true)
})

it('offers the entered password and clears the field on acceptance', async () => {
  const unlock = vi.fn().mockResolvedValue(true)
  mount(unlock)
  const field = screen.getByPlaceholderText('Enter password')
  fireEvent.change(field, { target: { value: 'fidelio2304' } })
  const submit = screen.getByRole('button', { name: 'Unlock' }) as HTMLButtonElement
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  await vi.waitFor(() => {
    expect(unlock).toHaveBeenCalledExactlyOnceWith('fidelio2304')
    expect((screen.getByPlaceholderText('Enter password') as HTMLInputElement).value).toBe('')
  })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('reports a refused password, clears the field, and leaves it ready to retry', async () => {
  const unlock = vi.fn().mockResolvedValue(false)
  mount(unlock)
  fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
  await vi.waitFor(() => {
    expect(unlock).toHaveBeenCalledExactlyOnceWith('wrong')
    expect((screen.getByPlaceholderText('Enter password') as HTMLInputElement).value).toBe('')
  })
  expect(screen.getByRole('alert').textContent).toBe('The password was not accepted. Try again.')
})

it('guards an empty submit and a second submit while one is in flight', async () => {
  let resolve!: (accepted: boolean) => void
  const unlock = vi.fn(() => new Promise<boolean>((resolvePromise) => { resolve = resolvePromise }))
  mount(unlock)
  const form = screen.getByRole('dialog').querySelector('form')!
  // An empty field is guarded before the password is ever offered.
  fireEvent.submit(form)
  expect(unlock).not.toHaveBeenCalled()
  // The first real submit goes in flight; a second submit is held behind it.
  fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'fidelio2304' } })
  fireEvent.submit(form)
  expect(unlock).toHaveBeenCalledTimes(1)
  fireEvent.submit(form)
  expect(unlock).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(true) })
  await vi.waitFor(() => { expect(unlock).toHaveBeenCalledTimes(1) })
})

it('closes through the mask and the close button without offering a password', () => {
  const unlock = vi.fn().mockResolvedValue(true)
  const { onClose } = mount(unlock)
  const mask = screen.getByRole('dialog').parentElement!.firstElementChild!
  fireEvent.click(mask)
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(2)
  expect(unlock).not.toHaveBeenCalled()
})

it('closes on Escape while the gate owns the foreground', () => {
  const unlock = vi.fn().mockResolvedValue(true)
  const { onClose } = mount(unlock)
  const gate = screen.getByRole('dialog')
  expect(document.activeElement).toBe(gate.querySelector('input')!)
  fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(unlock).not.toHaveBeenCalled()
})
