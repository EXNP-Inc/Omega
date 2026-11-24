// A locked browser peer meets the Host's settings unlock gate in place of the
// settings panel: the gate is shown, a refused password keeps it mounted with
// the Host's single refusal, and the current UTC password swaps it for the
// panel. The gate and its hourly re-lock are server-owned, so this scenario
// drives the real gate over the wire instead of a client mock.
import { chromium, type Page } from 'playwright'
import { describe, expect, it, onTestFinished } from 'vitest'
import { settingsUnlockPassword } from '@omega-ai/dsh-api-settings-controller'
import { launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold } from './scaffold.ts'
import { openSettings } from './support.ts'

const MODE = webSnapshotMode()

// The English gate copy the Host serves; it is the gate's own text, asserted
// here only to locate the gate, not to restate the panel's.
const GATE = {
  title: 'Settings are locked',
  placeholder: 'Enter password',
  submit: 'Unlock',
  error: 'The password was not accepted. Try again.',
} as const
const PANEL = 'Settings'

describe.skipIf(MODE === 'record')('web e2e: settings unlock gate', () => {
  // The gate renders once the peer's first `settings.describe` settles `locked`
  // true, a beat after the dialog attaches, so it is polled rather than assumed
  // already present when settings opens.
  async function waitForGate(page: Page) {
    const gate = page.getByRole('dialog', { name: GATE.title, exact: true })
    await gate.waitFor({ state: 'visible', timeout: 30_000 })
    return gate
  }

  async function bootEnglishSettingsPage(scaffold: WebScaffold) {
    const browser = await chromium.launch()
    onTestFinished(() => browser.close())
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, locale: 'en-US', timezoneId: 'Asia/Shanghai' })
    onTestFinished(() => page.context().close())
    const console = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('#root', { timeout: 30_000 })
    await openSettings(page, 'en', { leaveLocked: true })
    return { page, console }
  }

  it('shows the unlock gate in place of the settings panel', async () => {
    const scaffold = await launchWebScaffold({ developerTools: false })
    onTestFinished(() => scaffold.close())
    const { page, console } = await bootEnglishSettingsPage(scaffold)
    const gate = await waitForGate(page)
    // The gate is its own modal dialog; the settings panel is not mounted while
    // the gate holds the settings surface.
    expect(await gate.getByRole('textbox', { name: GATE.placeholder, exact: true }).count()).toBe(1)
    expect(await gate.getByRole('button', { name: GATE.submit, exact: true }).count()).toBe(1)
    expect(await page.getByRole('dialog', { name: PANEL, exact: true }).count()).toBe(0)
    expect(console.pageErrors).toEqual([])
  }, 120_000)

  it('keeps the gate mounted and shows the refusal for a wrong password', async () => {
    const scaffold = await launchWebScaffold({ developerTools: false })
    onTestFinished(() => scaffold.close())
    const { page, console } = await bootEnglishSettingsPage(scaffold)
    const gate = await waitForGate(page)
    await gate.getByRole('textbox', { name: GATE.placeholder, exact: true }).fill('not-the-current-password')
    await gate.getByRole('button', { name: GATE.submit, exact: true }).click()
    // The Host refuses with its single refusal, the field clears, and the gate
    // stays in place of the panel. `role="alert"` is name-from-author, so the
    // refusal is located by role and its text asserted, not matched by name.
    const alert = gate.getByRole('alert')
    await alert.waitFor({ timeout: 15_000 })
    expect((await alert.textContent())?.trim()).toBe(GATE.error)
    expect(await gate.getByRole('textbox', { name: GATE.placeholder, exact: true }).inputValue()).toBe('')
    expect(await page.getByRole('dialog', { name: PANEL, exact: true }).count()).toBe(0)
    expect(console.pageErrors).toEqual([])
  }, 120_000)

  it('swaps the gate for the settings panel on the current password', async () => {
    const scaffold = await launchWebScaffold({ developerTools: false })
    onTestFinished(() => scaffold.close())
    const { page, console } = await bootEnglishSettingsPage(scaffold)
    const gate = await waitForGate(page)
    await gate.getByRole('textbox', { name: GATE.placeholder, exact: true }).fill(settingsUnlockPassword(new Date()))
    await gate.getByRole('button', { name: GATE.submit, exact: true }).click()
    // An accepted unlock detaches the gate and mounts the panel in its place.
    await gate.waitFor({ state: 'detached', timeout: 15_000 })
    await page.getByRole('dialog', { name: PANEL, exact: true }).waitFor({ state: 'visible', timeout: 15_000 })
    expect(console.pageErrors).toEqual([])
  }, 120_000)
})
