// @vitest-environment jsdom
/**
 * The three right-sidebar commands resolve to the localized "unavailable"
 * reason while the hardened-mode gate is on, and act on them again when it
 * flips off. `page.close` and `page.refresh` are never guarded: they address
 * the window and the page, not the column.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@omega-ai/cordis'
import { createSnapshotStore } from '@omega-ai/dsh-client-store'
import { activeDockPaneId } from '@omega-ai/dsh-client-ui-dockkit'
import type { TabId } from '@omega-ai/dsh-client-ui-dockkit'
import type { ShortcutCommand } from '@omega-ai/dsh-client-shortcuts/client'
import type { SessionId } from '@omega-ai/dsh-session/types'
import { createSidebarRightController } from '../src/client/service.ts'
import { createSidebarRightStore } from '../src/client/stores.ts'
import { SidebarRightTabRegistry } from '../src/client/tab-registry.ts'
import { registerSidebarShortcuts } from '../src/client/shortcuts.ts'
import { en } from '../src/client/locales.ts'
import { makeTranslate } from '@omega-ai/dsh-client-test-runtime'

const SESSION = 'hardened' as SessionId
const releases: Array<() => void> = []
afterEach(() => {
  for (const release of releases.splice(0).reverse()) release()
  document.body.replaceChildren()
})

function boot(hardened: boolean) {
  const ctx = new Context()
  const tabs = new SidebarRightTabRegistry(ctx)
  tabs.register({ id: 'guide', kind: 'guide', title: () => 'guide' })
  const { controller, adopt, show, measure } = createSidebarRightController(tabs, vi.fn(), {
    autoFullscreen: () => false,
    openWithFocus: (_sessionId, open) => { open() },
    closeWithFocus: (_sessionId, _paneId, close) => { close() },
    hardened: () => hardened,
  })
  const store = createSidebarRightStore(() => ({ kind: 'guide', title: 'guide' })).create()
  releases.push(adopt(SESSION, store), () => { controller.tabDomain.dispose() })
  show(SESSION)
  measure(SESSION, () => true)
  store.actions.setExpanded(SESSION, true)
  const commands = new Map<string, ShortcutCommand>()
  releases.push(registerSidebarShortcuts({
    runtime: 'web',
    register: (command) => {
      commands.set(command.id, command)
      return () => { commands.delete(command.id) }
    },
  }, controller, makeTranslate(en), vi.fn(), createSnapshotStore(hardened)))
  const context = { region: 'page', modal: null, target: null } as const
  // Draw the expanded column's active pane the way the seat does, so a
  // commandTarget or focusedTarget read finds it: a session owner wrapping a
  // docked pane and its active tab, carrying the occurrence marker.
  const paneId = activeDockPaneId(store.getSnapshot().bySession[SESSION]!.layout)
  const node = store.getSnapshot().bySession[SESSION]!.layout.nodes[paneId]!
  const tabId = node.kind === 'pane' ? node.activeTabId : undefined
  const owner = document.createElement('section')
  owner.dataset.sidebarRightSession = SESSION
  const pane = document.createElement('section')
  pane.tabIndex = -1
  pane.dataset.dockkitPane = paneId
  owner.append(pane)
  let tab: HTMLElement | undefined
  if (tabId !== undefined) {
    tab = document.createElement('div')
    tab.tabIndex = 0
    tab.dataset.dockkitTab = tabId
    tab.dataset.sidebarRightOccurrence = controller.tabDomain.occurrence(SESSION, { id: tabId as TabId }).id
    pane.append(tab)
    tab.focus()
  }
  document.body.append(owner)
  return { controller, store, commands, context, pane, tab }
}

describe('right sidebar shortcuts and the hardened gate', () => {
  it('blocks every right-sidebar command with the unavailable reason while the gate is on', () => {
    const { controller, commands, context } = boot(true)
    for (const id of ['sidebar.right.toggle', 'pane.split', 'pane.fullscreen.toggle'] as const) {
      const result = commands.get(id)!.resolve(context)
      expect(result.status).toBe('blocked')
      expect(result).toMatchObject({ reason: en['command.sidebarUnavailable'] })
    }
    // The gate also stops the column being opened or moved through the API.
    expect(controller.split()).toBeUndefined()
    expect(() => { controller.openResource('dsh-resource://file/session/hardened/a.txt') }).not.toThrow()
  })

  it('acts on the commands again when the gate is off', () => {
    const { store, commands, context, pane, tab } = boot(false)
    const element = tab ?? pane
    const resolve = (id: string) => commands.get(id)!.resolve({ ...context, target: element })
    // Split acts on the focused pane: the docked pane gains a neighbour.
    const docked = () => Object.values(store.getSnapshot().bySession[SESSION]!.layout.nodes)
      .filter(node => node.kind === 'pane' && node.host === 'dock').length
    const split = resolve('pane.split')
    expect(split.status).toBe('handled')
    if (split.status !== 'handled') throw new Error('Expected a handled split')
    split.run()
    expect(docked()).toBeGreaterThan(1)
    // The toggle resolves against the active pane and flips the column.
    const expanded = store.getSnapshot().bySession[SESSION]!.layout.expanded
    const toggle = resolve('sidebar.right.toggle')
    expect(toggle.status).toBe('handled')
    if (toggle.status !== 'handled') throw new Error('Expected a handled toggle')
    toggle.run()
    expect(store.getSnapshot().bySession[SESSION]!.layout.expanded).toBe(!expanded)
    // The refresh path never reaches the gate: judged on the target alone, it
    // is refused for having no refreshable page, not for the column being off.
    expect(commands.get('page.refresh')!.resolve(context)).toMatchObject({ status: 'blocked', reason: en['command.noRefresh'] })
  })
})
