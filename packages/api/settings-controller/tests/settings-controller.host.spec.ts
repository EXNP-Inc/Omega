/** Remote form operations over real Cordis profile configuration. */
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { Context } from '@omega-ai/cordis'
import { Peer } from '@omega-ai/dsh-client-connection'
import type { PeerScope, Principal, PrincipalMap, RemoteInvocation } from '@omega-ai/dsh-typert-protocol'
import { remoteErrorOf, remoteMethods } from '@omega-ai/dsh-typert-protocol'
import SettingsController, { settingsUnlockPassword, settingsWriteExemptFromGate } from '../src/index.ts'
import { configurationFixture } from '../../../settings/settings/tests/configuration-fixture.ts'
import { MemoryCredentials } from '../../../credentials/credentials/tests/memory.ts'

declare module '@omega-ai/dsh-typert-protocol' {
  interface PrincipalMap {
    /** Test-only non-owner caller, for the owner-only unlock path. */
    'settings-test-auditor': { readonly kind: 'settings-test-auditor'; readonly note: string }
  }
}

type Auditor = PrincipalMap['settings-test-auditor']

const OWNER: Principal = { kind: 'owner' }
const AUDITOR: Auditor = { kind: 'settings-test-auditor', note: 'not the owner' }

/** The invocation a Gateway binds while dispatching a `settings/*` call for one peer. */
function invocationFor(peer: PeerScope, method = 'describe'): RemoteInvocation {
  return {
    request: { namespace: 'settings', method, args: {} },
    service: 'settingsController',
    peer,
    signal: new AbortController().signal,
    uplink: <In>(): AsyncIterable<In> => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) }),
  }
}

/** A receiver whose settings calls speak for `peer`, exactly as the Gateway dispatches them. */
function callAs(ctx: Context, peer: PeerScope, method: string) {
  return ctx.extend({ invocation: invocationFor(peer, method) }).settingsController
}

/** The credentials receiver for `peer`, mirroring the Gateway's `credentials/*` dispatch. */
function credentialsAs(ctx: Context, peer: PeerScope) {
  return ctx.extend({ invocation: invocationFor(peer, 'describe') }).credentialsController
}

/** One persistent owner peer, as the web connection keeps for a browser, plus its teardown. */
async function ownerPeer(ctx: Context): Promise<PeerScope> {
  const peer = new Peer(ctx, { principal: OWNER })
  onTestFinished(async () => await peer.dispose())
  return peer
}

async function boot() {
  const fixture = await configurationFixture()
  await fixture.ctx.plugin(SettingsController)
  return { ...fixture, controller: fixture.ctx.settingsController }
}

describe('settings Remote', () => {
  it('publishes form operations and the credentials namespace', async () => {
    const { ctx, controller } = await boot()
    expect(controller.typertRemote.namespace).toBe('settings')
    expect(remoteMethods(controller).map(method => method.method)).toEqual([
      'describe', 'update', 'replace', 'mutate', 'openSettingsDocument', 'unlock',
    ])
    expect(ctx.get('credentialsController')).toBeDefined()
  })

  it('redacts every described layer and applies mutations through the consumer', async () => {
    const { controller, ctx } = await boot()
    const describe = controller.describe()
    expect(describe).toMatchObject({ writable: true, hasDocument: true })
    expect(JSON.stringify(describe)).not.toContain('private')
    const model = describe.namespaces.find(row => row.ns === 'default-model')!
    const saved = await controller.mutate(model.ns, [{ op: 'set', path: ['model'], value: 'next' }], model.revision)
    expect(saved.value).toEqual({ provider: 'test', model: 'next' })
    expect(ctx.agentDefaultModel.currentSelection().model).toBe('next')
    await expect(controller.update(model.ns, { model: 'stale' }, model.revision)).rejects.toMatchObject({ code: 'settings/conflict' })
    await expect(controller.update('first', { count: 0 }, undefined)).rejects.toMatchObject({ code: 'settings/rejected' })
    await expect(controller.update('', {}, undefined)).rejects.toMatchObject({ code: 'gateway/bad-request' })
    await expect(controller.update('missing', {}, undefined)).rejects.toMatchObject({ code: 'settings/rejected' })
    expect((await controller.replace('default-model', {}, undefined)).value).toEqual({ provider: 'test', model: 'original' })
  })

  it('reports an absent Config form service', async () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const controller = new SettingsController(ctx)
    expect(() => controller.describe()).toThrow('settings service is absent')
    const failure = await controller.update('missing', {}, undefined).catch((error: unknown) => error)
    expect(remoteErrorOf(failure)?.code).toBe('gateway/internal')
  })

  it('opens the profile patch and contains opener failure and cancellation', async () => {
    const { ctx, profile } = await configurationFixture()
    const openTextFile = vi.fn(async (_path: string, _signal: AbortSignal) => {})
    const controller = new SettingsController(ctx, { openTextFile })
    const abort = new AbortController()
    await controller.openSettingsDocument(abort.signal)
    expect(openTextFile).toHaveBeenCalledWith(profile.patchPath, abort.signal)
    openTextFile.mockRejectedValueOnce(new Error('no editor'))
    await expect(controller.openSettingsDocument(abort.signal)).rejects.toMatchObject({ code: 'gateway/internal' })
    abort.abort()
    await expect(controller.openSettingsDocument(abort.signal)).rejects.toMatchObject({ code: 'gateway/cancelled' })
  })

  it('does not open a patch cancelled while preparation is pending', async () => {
    const { ctx } = await configurationFixture()
    const prepared = Promise.withResolvers<string>()
    vi.spyOn(ctx.settings, 'prepareDocument').mockReturnValue(prepared.promise)
    const openTextFile = vi.fn(async (_path: string, _signal: AbortSignal) => {})
    const controller = new SettingsController(ctx, { openTextFile })
    const abort = new AbortController()
    const opening = controller.openSettingsDocument(abort.signal)
    abort.abort()
    prepared.resolve('/tmp/cordis.patch.yml')
    await expect(opening).rejects.toMatchObject({ code: 'gateway/cancelled' })
    expect(openTextFile).not.toHaveBeenCalled()
  })

})

it('omits absent optional descriptor fields and contains primitive write failures', async () => {
  const { ctx, controller } = await boot()
  vi.spyOn(ctx.settings, 'describe').mockReturnValue([{ ns: 'first' as never, schema: {}, value: {}, autoGenerate: true, applies: 'live', revision: 0 }])
  expect(controller.describe().namespaces[0]).toEqual({ ns: 'first', schema: {}, value: {}, autoGenerate: true, applies: 'live', revision: 0, secrets: [] })
  vi.spyOn(ctx.settings, 'update').mockRejectedValueOnce('storage unavailable')
  await expect(controller.update('first', {}, undefined)).rejects.toMatchObject({ code: 'settings/rejected' })
})

it('reports a form removed after its write committed', async () => {
  const { ctx, controller } = await boot()
  const entry = ctx.configEditor.entries().find(row => row.options.id === 'first')!
  vi.spyOn(ctx.settings, 'update').mockImplementation(async () => { entry.parent.remove(entry.options.id) })
  await expect(controller.update('first', {}, undefined)).rejects.toMatchObject({ code: 'gateway/internal' })
})

it('classifies document preparation failures and cancellation during opening', async () => {
  const { ctx } = await configurationFixture({ hmr: false })
  let abort = new AbortController()
  const controller = new SettingsController(ctx, { openTextFile: async () => {
    abort.abort(); throw new Error('opening cancelled')
  } })
  const prepare = vi.spyOn(ctx.settings, 'prepareDocument')
  prepare.mockRejectedValueOnce(new Error('unreadable profile'))
  await expect(controller.openSettingsDocument(abort.signal)).rejects.toMatchObject({ code: 'gateway/internal' })
  prepare.mockImplementationOnce(async () => { abort.abort(); throw new Error('preparation cancelled') })
  await expect(controller.openSettingsDocument(abort.signal)).rejects.toMatchObject({ code: 'gateway/cancelled' })
  abort = new AbortController()
  await expect(controller.openSettingsDocument(abort.signal)).rejects.toMatchObject({ code: 'gateway/cancelled' })
})

describe('the settings unlock gate over a peer-identified call', () => {
  /** A controllable clock pinned inside one UTC hour, so the password is stable across a test. */
  function pinnedClock() {
    let ms = Date.UTC(2026, 10, 23, 2, 30)
    return { set(next: number) { ms = next }, value: () => new Date(ms) }
  }

  /** Capture the failure of a remote call that throws synchronously or rejects. */
  async function failureOf(fn: () => unknown): Promise<unknown> {
    try {
      await fn()
      return undefined
    } catch (error) {
      return error
    }
  }

  it('gates a locked peer\'s writes while its reads and credential metadata still answer', async () => {
    const fixture = await configurationFixture()
    const clock = pinnedClock()
    await fixture.ctx.plugin(MemoryCredentials, { OMEGA_API_KEY: 'sk-seeded' })
    await fixture.ctx.plugin(SettingsController, { now: clock.value })
    const ctx = fixture.ctx
    const peer = await ownerPeer(ctx)
    const password = settingsUnlockPassword(clock.value())

    // Locked: reads are not refused — the settings describe reports the lock in
    // its `locked` field and the credential metadata still answers redacted —
    // but every write answers settings/locked.
    expect(callAs(ctx, peer, 'describe').describe()).toMatchObject({ writable: true, hasDocument: true, locked: true })
    expect((await credentialsAs(ctx, peer).describe(['OMEGA_API_KEY'])).OMEGA_API_KEY)
      .toEqual({ configured: true, source: 'memory', writable: true })
    expect(remoteErrorOf(await failureOf(() => callAs(ctx, peer, 'update').update('default-model', { model: 'x' }, undefined))))
      .toMatchObject({ code: 'settings/locked', details: {} })

    // Unlock with the current UTC password: the gate clears for this peer.
    expect(callAs(ctx, peer, 'unlock').unlock(password)).toEqual({ unlocked: true })
    expect(callAs(ctx, peer, 'describe').describe()).toMatchObject({ writable: true, hasDocument: true, locked: false })
    await expect(callAs(ctx, peer, 'update').update('default-model', { model: 'x' }, undefined)).resolves.toBeDefined()

    // A second peer's unlock does not clear the first peer's still-locked writes.
    const other = await ownerPeer(ctx)
    expect(callAs(ctx, other, 'describe').describe()).toMatchObject({ hasDocument: true, locked: true })
    expect(remoteErrorOf(await failureOf(() => callAs(ctx, other, 'update').update('default-model', { model: 'x' }, undefined))))
      .toMatchObject({ code: 'settings/locked' })
    expect(callAs(ctx, other, 'unlock').unlock(password)).toEqual({ unlocked: true })
    expect(callAs(ctx, other, 'describe').describe()).toMatchObject({ hasDocument: true, locked: false })
    expect(callAs(ctx, peer, 'describe').describe()).toMatchObject({ hasDocument: true, locked: false })
  })

  it('refuses an unlock from a peer that is not the owner', async () => {
    const fixture = await configurationFixture()
    const clock = pinnedClock()
    await fixture.ctx.plugin(SettingsController, { now: clock.value })
    const ctx = fixture.ctx
    const auditor = new Peer(ctx, { principal: AUDITOR })
    onTestFinished(async () => await auditor.dispose())
    const failure = await failureOf(() => callAs(ctx, auditor, 'unlock').unlock(settingsUnlockPassword(clock.value())))
    expect(remoteErrorOf(failure)).toMatchObject({ code: 'settings/rejected', details: { ns: 'settings' } })
  })

  it('refuses a wrong password and re-locks at the next UTC hour', async () => {
    const fixture = await configurationFixture()
    const clock = pinnedClock()
    await fixture.ctx.plugin(SettingsController, { now: clock.value })
    const ctx = fixture.ctx
    const peer = await ownerPeer(ctx)
    expect(remoteErrorOf(await failureOf(() => callAs(ctx, peer, 'unlock').unlock('fidelio0000'))))
      .toMatchObject({ code: 'settings/rejected' })
    expect(callAs(ctx, peer, 'unlock').unlock(settingsUnlockPassword(clock.value()))).toEqual({ unlocked: true })
    expect(callAs(ctx, peer, 'describe').describe()).toMatchObject({ hasDocument: true, locked: false })
    // Advance past the UTC hour boundary: the fact expires, the describe
    // reports the re-lock, and writes refuse again.
    clock.set(clock.value().getTime() + 3_600_000)
    expect(callAs(ctx, peer, 'describe').describe()).toMatchObject({ hasDocument: true, locked: true })
    expect(remoteErrorOf(await failureOf(() => callAs(ctx, peer, 'update').update('default-model', { model: 'x' }, undefined))))
      .toMatchObject({ code: 'settings/locked' })
  })

  it('lets an in-process call (no peer) through without a password', async () => {
    const fixture = await configurationFixture()
    await fixture.ctx.plugin(SettingsController)
    expect(fixture.ctx.settingsController.describe()).toMatchObject({ writable: true, hasDocument: true })
  })

  it('leaves the volatile onboarding-ack namespace writable while every other write and credential stays locked', async () => {
    const fixture = await configurationFixture()
    const clock = pinnedClock()
    await fixture.ctx.plugin(MemoryCredentials, { OMEGA_API_KEY: 'sk-seeded' })
    await fixture.ctx.plugin(SettingsController, { now: clock.value })
    const ctx = fixture.ctx
    const peer = await ownerPeer(ctx)
    expect(callAs(ctx, peer, 'describe').describe()).toMatchObject({ hasDocument: true, locked: true })

    // The exemption is scoped to the volatile onboarding namespace and nothing
    // else: it is the one namespace whose sole field is the boot notice ack,
    // which a first-run client must be able to persist before it holds the
    // password so the notice can be dismissed and the unlock reached.
    expect(settingsWriteExemptFromGate('ui-settings-general')).toBe(true)
    expect(settingsWriteExemptFromGate('default-model')).toBe(false)
    expect(settingsWriteExemptFromGate('plugins')).toBe(false)

    // Still locked: a sensitive namespace write and a credentials write refuse.
    // The credentials namespace shares the gate, so the exemption must not
    // leak into it.
    expect(remoteErrorOf(await failureOf(() => callAs(ctx, peer, 'update').update('default-model', { model: 'x' }, undefined))))
      .toMatchObject({ code: 'settings/locked' })
    expect(remoteErrorOf(await failureOf(() => credentialsAs(ctx, peer).set('OMEGA_API_KEY', 'sk-again'))))
      .toMatchObject({ code: 'settings/locked' })

    // But the exempt onboarding namespace passes the gate for a locked peer and
    // reaches the settings service — this is what keeps a fresh install from
    // deadlocking at the welcome notice before the password is ever entered.
    // The fixture composes no `ui-settings-general` plugin, so stub the write:
    // an ungated call is observed as the provider being invoked, a gated one
    // would throw `settings/locked` before the provider could see it.
    const update = vi.spyOn(ctx.settings, 'update').mockResolvedValue(undefined)
    await callAs(ctx, peer, 'update').update('ui-settings-general', { welcomeNoticeVersion: '2026-09-28.1' }, undefined).catch(error => error)
    expect(update).toHaveBeenCalledWith('ui-settings-general', { welcomeNoticeVersion: '2026-09-28.1' }, undefined)
  })
})
