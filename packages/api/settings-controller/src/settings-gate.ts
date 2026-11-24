/**
 * Server-side unlock gate for the configuration surfaces. The password is
 * checked only on the Host with a constant-time comparison, so a client that
 * tampers with its own JavaScript cannot learn or bypass it. An unlock is a
 * short-lived, per-peer fact: it expires at the next UTC hour boundary (the
 * password rolls with the hour) and it is removed when the granting peer is
 * disposed. In-process callers, which arrive with no peer, are never locked.
 *
 * @module @omega-ai/dsh-api-settings-controller/src/settings-gate.ts
 */

import { timingSafeEqual } from 'node:crypto'
import type { PeerScope } from '@omega-ai/dsh-typert-protocol'
import { RemoteError } from '@omega-ai/dsh-typert-protocol'

/** The unlock password stem; the password is the stem plus the UTC day and hour. */
const PASSWORD_STEM = 'fidelio'

/**
 * Settings namespaces that write without an unlock fact. The boot-level
 * onboarding notice must be dismissible before a peer holds the password, and
 * this namespace carries only that one volatile acknowledgement — no secret,
 * endpoint, or other sensitive value — so exempting it leaks nothing. Every
 * other namespace, and every credentials write, stays fully gated.
 */
const GATE_EXEMPT_NAMESPACES: ReadonlySet<string> = new Set(['ui-settings-general'])

/** One hour in milliseconds, the granularity at which the password rolls. */
const HOUR_MS = 3_600_000

/**
 * Whether a settings namespace write passes the gate without an unlock fact.
 * Only the volatile onboarding-ack namespace is exempt; all others, and all
 * credentials writes, require the caller's peer to hold a fresh fact.
 * @param ns - the settings namespace the write addresses.
 * @returns whether the namespace is exempt from the unlock gate.
 */
export function settingsWriteExemptFromGate(ns: string): boolean {
  return GATE_EXEMPT_NAMESPACES.has(ns)
}

/** Two digits, zero-padded for the single- and double-digit values. */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The settings unlock password for one UTC instant: `fidelio` plus the 2-digit
 * UTC day and 2-digit UTC 24h hour. Evaluated at the moment of entry, it
 * differs on every UTC hour and so re-locks the surfaces each hour.
 * @param now - the instant whose UTC day and hour form the password.
 * @returns the password valid for `now`'s UTC hour.
 */
export function settingsUnlockPassword(now: Date): string {
  return PASSWORD_STEM + pad2(now.getUTCDate()) + pad2(now.getUTCHours())
}

/**
 * The epoch milliseconds of the next UTC hour boundary strictly after `now`.
 * An unlock granted at `now` is valid until this instant.
 * @param now - the grant instant.
 * @returns the epoch ms of the next UTC hour boundary.
 */
export function nextUtcHourBoundary(now: Date): number {
  return Math.floor(now.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS
}

/** One peer's granted unlock, bound to a UTC hour and the peer's lifetime. */
interface UnlockFact {
  /** Epoch ms the fact was granted. */
  readonly unlockedAt: number
  /** Epoch ms the fact stops being valid (the next UTC hour boundary). */
  readonly expiresAt: number
}

/**
 * The unlock state of the configuration surfaces. It owns the per-peer facts
 * and checks the rolling password in constant time. The owning
 * `SettingsController` creates one instance and hands it to the
 * `CredentialsController` so both namespaces lock and unlock together.
 */
export class SettingsGate {
  /** Facts keyed by peer id; a peer's fact is removed when the peer is disposed. */
  private readonly unlocked = new Map<PeerScope['id'], UnlockFact>()
  /** Clock supplying the current instant; injectable so tests can roll the hour. */
  private readonly now: () => Date

  /**
   * @param now - clock supplying the current instant; defaults to the real clock.
   */
  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  /**
   * Whether `peer` holds a still-valid unlock fact. An absent fact, or one that
   * reached its UTC hour boundary, leaves the surfaces locked; an expired fact
   * is dropped as it is observed.
   * @param peer - the peer to check.
   * @returns whether the peer may pass the gate.
   */
  isUnlocked(peer: PeerScope): boolean {
    const fact = this.unlocked.get(peer.id)
    if (fact === undefined) return false
    if (this.now().getTime() >= fact.expiresAt) {
      this.unlocked.delete(peer.id)
      return false
    }
    return true
  }

  /**
   * Check `password` against the current UTC hour's password and, on a match,
   * record a short-lived unlock fact for `peer`. The comparison is constant
   * time, so a wrong guess is rejected without revealing which part differed.
   * The fact expires at the next UTC hour boundary and is removed when the
   * peer is disposed.
   * @param peer - the peer to unlock.
   * @param password - the submitted password.
   * @returns whether the password matched the current UTC hour's password.
   */
  unlock(peer: PeerScope, password: string): boolean {
    const now = this.now()
    const expected = settingsUnlockPassword(now)
    const actualBytes = Buffer.from(password, 'utf8')
    const expectedBytes = Buffer.from(expected, 'utf8')
    const ok = actualBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(actualBytes, expectedBytes)
    if (!ok) return false
    const fact: UnlockFact = { unlockedAt: now.getTime(), expiresAt: nextUtcHourBoundary(now) }
    this.unlocked.set(peer.id, fact)
    peer.ctx.effect(
      () => () => { this.unlocked.delete(peer.id) },
      'settings-gate: unlock fact',
    )
    return true
  }

  /**
   * Pass callers that have no peer (in-process, trusted) and raise the locked
   * failure for a peer that holds no fresh unlock fact.
   * @param peer - the caller's peer, or `undefined` for an in-process call.
   * @throws RemoteError `settings/locked` when the peer's fact is absent or has
   *   reached its UTC hour boundary.
   */
  requireUnlocked(peer: PeerScope | undefined): void {
    if (peer === undefined) return
    if (!this.isUnlocked(peer)) {
      throw new RemoteError('settings/locked', 'settings are locked: enter the current password', {})
    }
  }
}
