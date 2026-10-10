/** Web Omega configuration, credential reuse, and saved model selection. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  captureStableAria, compareOrRefreshGolden, launchWebScaffold,
  watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { openSettings, connectFreshWorkspaceZh, saveFailureShot, ZH_BROWSER_LOCALE } from './support.ts'

const EXPECTED = fileURLToPath(new URL('./expected/omega-messages-settings/', import.meta.url))

describe.skipIf(webSnapshotMode() === 'record')('web e2e: Omega Messages settings', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ omegaMissingCredential: true })
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  }, 120_000)

  afterAll(async () => {
    try {
      await browser?.close()
    } finally {
      await scaffold?.close()
    }
  })

  it('offers one Omega card and saves Messages settings using the existing credential reference', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-omega-messages-settings'))
    expect(scaffold.ctx.llm.listProviders()).toContainEqual({ id: 'omega-official', name: 'Omega' })
    expect(scaffold.ctx.llm.listProviders().filter(provider => provider.id === 'omega-official')).toHaveLength(1)
    // The shipped default now sits on the local Mac route; this scenario is
    // about the Omega Messages flow, so pin the default back onto the keyless
    // omega row the onboarding dialog then prompts for.
    expect(scaffold.ctx.agentDefaultModel.currentSelection())
      .toEqual({ provider: 'mac', model: 'qwen3.8-27b-lite', reasoningEffort: 'xhigh' })
    await scaffold.ctx.agentDefaultModel.saveSelection({ provider: 'omega-official', model: 'omega-flash' })
    const onboarding = page.getByRole('dialog', { name: '添加一个 API Key 开始使用' })
    await onboarding.getByLabel('API 密钥', { exact: true }).fill('sk-messages-onboarding')
    await onboarding.getByRole('button', { name: '保存并继续' }).click()
    await onboarding.waitFor({ state: 'detached' })
    await openSettings(page, 'zh')
    const dialog = page.getByRole('dialog', { name: '设置', exact: true })
    await dialog.getByRole('button', { name: '模型', exact: true }).click()
    await dialog.getByText('Omega', { exact: true }).waitFor()
    expect(await dialog.getByText('Omega', { exact: true }).count()).toBe(1)
    await dialog.getByText('Omega', { exact: true }).locator('xpath=ancestor::li').getByRole('button', { name: '编辑' }).click()
    const messages = dialog
    await messages.getByText('自定义设置', { exact: true }).click()
    expect(await messages.getByLabel('API 地址', { exact: true }).getAttribute('placeholder'))
      .toBe('https://api.omega.com/anthropic')
    await compareOrRefreshGolden(join(EXPECTED, 'cards.expected.md'),
      await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd), webSnapshotMode())
    await messages.getByLabel('API 密钥', { exact: true }).fill('sk-e2e-messages')
    await messages.getByLabel('API 地址', { exact: true }).fill('https://messages.example/anthropic')
    // The shipped omega catalog is empty, so the custom editor opens with no
    // rows: add the Messages model by hand, with the image input the resolver
    // assertion below expects.
    expect(await messages.getByText('模型选择器中将不显示任何模型；目录外 ID 仍可直接发送。', { exact: true }).count()).toBe(1)
    await messages.getByRole('button', { name: '添加模型', exact: true }).click()
    await messages.getByLabel('模型 ID 1').fill('omega-flash')
    await messages.getByLabel('显示名称 1', { exact: true }).fill('Messages Flash')
    await messages.getByRole('button', { name: '模型选项 1' }).click()
    await messages.getByRole('group', { name: '输入类型 1' }).getByRole('checkbox', { name: '图片' }).check()
    await messages.getByRole('button', { name: '保存', exact: true }).click()
    await dialog.getByText('已保存 Omega (omega-official)。', { exact: true }).waitFor()

    const settings = await readFile(join(scaffold.harnessHome, 'profiles', 'scaffold', 'cordis.patch.yml'), 'utf8')
    expect(settings).toContain('https://messages.example/anthropic')
    expect(settings).toContain('id: llm-omega')
    // UI-added models carry no catalog fields (no systemPromptUpdate): the
    // empty-catalog flow resolves id, display name, and declared input only.
    await expect(scaffold.ctx.llm.resolveModelInfo('omega-official', 'omega-flash')).resolves.toMatchObject({
      name: 'Messages Flash', inputModalities: ['text', 'image'],
    })
    expect(scaffold.ctx.settings.describe().find(row => row.ns === 'llm-omega')?.value).not.toHaveProperty('protocol')
    expect(settings).not.toContain('sk-e2e-')
    const credentials = await readFile(join(scaffold.harnessHome, '.credentials.yaml'), 'utf8')
    expect(credentials).toContain('OMEGA_API_KEY: sk-e2e-messages')
    expect(credentials).not.toContain('OMEGA_MESSAGES_API_KEY')
    expect(await page.locator('body').innerText()).not.toContain('sk-e2e-')
    await page.keyboard.press('Escape')
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd, 'messages-settings-e2e')
    await page.getByRole('button', { name: /^选择模型/ }).click()
    await page.getByRole('menuitem', { name: /模型/ }).click()
    await page.getByRole('menuitemradio', { name: 'Messages Flash', exact: true }).waitFor()
    await compareOrRefreshGolden(join(EXPECTED, 'picker.expected.md'),
      await captureStableAria(page, '[role="group"][aria-label="模型与推理等级"]', scaffold.workspaceCwd), webSnapshotMode())
    await page.keyboard.press('Escape')
    await page.getByRole('menuitem', { name: /推理等级/ }).click()
    const effortWeights = await page.getByRole('menuitemradio').evaluateAll(rows => rows.map(row =>
      getComputedStyle(row.querySelector('span span')!).fontWeight,
    ))
    expect(new Set(effortWeights)).toEqual(new Set(['400']))
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('selects an available Omega model after provider settings remove the default', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-omega-messages-default'))
    await page.keyboard.press('Escape')
    await scaffold.ctx.agentDefaultModel.saveSelection({ provider: 'omega-official', model: 'omega-v4-flash' })
    await page.reload({ waitUntil: 'load' })
    const input = page.locator('[data-composer-input]').first()
    const trigger = page.getByRole('button', { name: /^选择模型.*omega-official\/omega-v4-flash/ })
    await trigger.waitFor()
    await expect.poll(() => input.getAttribute('contenteditable')).toBe('true')
    await trigger.click()
    await page.getByRole('menuitem', { name: /模型/ }).click()
    await page.getByRole('menuitemradio', { name: 'Messages Flash', exact: true }).click()
    await expect.poll(() => input.getAttribute('contenteditable')).toBe('true')
    await expect.poll(() => scaffold.ctx.agentDefaultModel.currentSelection().provider).toBe('omega-official')
    const settings = await readFile(join(scaffold.harnessHome, 'profiles', 'scaffold', 'cordis.patch.yml'), 'utf8')
    expect(settings).toContain('provider: omega-official')
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)
})
