/**
 * The server-side settings unlock gate: a UTC-rolling password checked in
 * constant time, a short-lived per-peer unlock fact, and in-process pass-through.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@omega-ai/cordis'
import { Peer } from '@omega-ai/dsh-client-connection'
import type { PeerScope, Principal } from '@omega-ai/dsh-typert-protocol'
import { remoteErrorOf } from '@omega-ai/dsh-typert-protocol'
import { SettingsGate, settingsUnlockPassword, nextUtcHourBoundary } from '../src/settings-gate.ts'

const OWNER: Principal = { kind: 'owner' }

/** A fresh owner peer under a throwaway context, so a test controls its lifetime. */
function makePeer(root: Context): PeerScope {
  return new Peer(root, { principal: OWNER })
}

/** A controllable clock: `set(ms)` advances the instant the gate reads. */
function clockOf(start: Date) {
  let ms = start.getTime()
  return {
    set(next: number) { ms = next },
    value() { return new Date(ms) },
    now: () => new Date(ms),
  }
}

describe('settingsUnlockPassword', () => {
  it('is the stem plus the 2-digit UTC day and 2-digit UTC hour', () => {
    expect(settingsUnlockPassword(new Date(Date.UTC(2026, 10, 23, 2, 15)))).toBe('fidelio2302')
    expect(settingsUnlockPassword(new Date(Date.UTC(2026, 10, 23, 23, 59)))).toBe('fidelio2323')
    expect(settingsUnlockPassword(new Date(Date.UTC(2026, 10, 1, 0, 0)))).toBe('fidelio0100')
  })

  it('changes at every UTC hour boundary', () => {
    const boundary = new Date(Date.UTC(2026, 10, 23, 2, 0, 0))
    expect(settingsUnlockPassword(new Date(boundary.getTime() - 1000))).toBe('fidelio2301')
    expect(settingsUnlockPassword(boundary)).toBe('fidelio2302')
  })
})

describe('nextUtcHourBoundary', () => {
  it('is the next whole UTC hour strictly after the instant', () => {
    const t = Date.UTC(2026, 10, 23, 2, 15)
    expect(nextUtcHourBoundary(new Date(t))).toBe(Date.UTC(2026, 10, 23, 3, 0))
  })

  it('sits exactly one hour after a whole-hour instant', () => {
    const t = Date.UTC(2026, 10, 23, 3, 0)
    expect(nextUtcHourBoundary(new Date(t))).toBe(t + 3_600_000)
  })
})

describe('SettingsGate unlock and pass-through', () => {
  it('lets an in-process caller (no peer) through every check', () => {
    const gate = new SettingsGate()
    expect(() => gate.requireUnlocked(undefined)).not.toThrow()
  })

  it('locks a peer that has not unlocked', () => {
    const root = new Context()
    const peer = makePeer(root)
    const gate = new SettingsGate()
    expect(gate.isUnlocked(peer)).toBe(false)
    expect(() => gate.requireUnlocked(peer)).toThrow('settings are locked')
  })

  it('unlocks a peer with the current UTC password and locks again next hour', () => {
    const root = new Context()
    const peer = makePeer(root)
    const clock = clockOf(new Date(Date.UTC(2026, 10, 23, 2, 30)))
    const gate = new SettingsGate(clock.now)
    expect(gate.unlock(peer, 'wrong')).toBe(false)
    expect(gate.isUnlocked(peer)).toBe(false)
    expect(gate.unlock(peer, settingsUnlockPassword(clock.value()))).toBe(true)
    expect(gate.isUnlocked(peer)).toBe(true)
    expect(() => gate.requireUnlocked(peer)).not.toThrow()
    // Advance to the next UTC hour: the fact expires and the peer re-locks.
    clock.set(clock.value().getTime() + 3_600_000)
    expect(gate.isUnlocked(peer)).toBe(false)
    expect(() => gate.requireUnlocked(peer)).toThrow('settings are locked')
  })

  it('rejects a wrong password with constant-time comparison (length mismatch included)', () => {
    const root = new Context()
    const peer = makePeer(root)
    const gate = new SettingsGate()
    for (const guess of ['fidelio', '', 'fidelio23', 'fidelio2302x', 'FIDELIO2302']) {
      expect(gate.unlock(peer, guess)).toBe(false)
    }
    expect(gate.isUnlocked(peer)).toBe(false)
  })

  it('keeps unlock facts per peer: one peer unlocking leaves another locked', () => {
    const root = new Context()
    const a = makePeer(root)
    const b = makePeer(root)
    const clock = clockOf(new Date(Date.UTC(2026, 10, 23, 5, 0)))
    const gate = new SettingsGate(clock.now)
    expect(gate.unlock(a, settingsUnlockPassword(clock.value()))).toBe(true)
    expect(gate.isUnlocked(a)).toBe(true)
    expect(gate.isUnlocked(b)).toBe(false)
  })
})

describe('SettingsGate peer-dispose cleanup', () => {
  it('drops an unlock fact when its peer is disposed', async () => {
    const root = new Context()
    const clock = clockOf(new Date(Date.UTC(2026, 10, 23, 5, 0)))
    const gate = new SettingsGate(clock.now)
    const peer = makePeer(root)
    expect(gate.unlock(peer, settingsUnlockPassword(clock.value()))).toBe(true)
    expect(gate.isUnlocked(peer)).toBe(true)
    await peer.dispose()
    expect(gate.isUnlocked(peer)).toBe(false)
    await root.fiber.dispose()
  })

  it('raises the locked failure with the settings/locked code for a peer without a fact', () => {
    const root = new Context()
    const peer = makePeer(root)
    const gate = new SettingsGate()
    let failure: unknown
    try {
      gate.requireUnlocked(peer)
    } catch (error) {
      failure = error
    }
    expect(remoteErrorOf(failure)).toMatchObject({ code: 'settings/locked', details: {} })
  })
})
