/**
 * Client mirror of the Host settings document: the one `settings.describe`
 * reader in the browser. Every settings consumer derives from this store —
 * shared entry forms through `ConfigForms.get`, cross-namespace
 * surfaces through the provider's shared describe face — so startup cost and
 * freshness are properties of this class, not of how many features own a
 * preference. The Host stays the fact source: the mirror re-reads on the
 * invalidations its owning plugin subscribes to and folds write answers in
 * through {@link SettingsDescribeMirror.acceptView}.
 */

import type { Context as ClientContext } from '@omega-ai/cordis'
import type { SettingsNamespaceView } from '@omega-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@omega-ai/dsh-client-store'

/** The full `settings.describe` answer the mirror serves. */
export interface SettingsDescribeView {
  /** Every namespace a live Host plugin registered, as the Host reported it. */
  namespaces: readonly SettingsNamespaceView[]
  /** Whether the settings provider accepts writes. */
  writable: boolean
  /** Whether a native settings document exists for the Host to open. */
  hasDocument: boolean
  /**
   * The caller's settings-gate lock state, as the Host reported it for this
   * read. It is the sole source of the snapshot's `locked` flag: the Host
   * re-locks each UTC hour and clears it on an accepted unlock.
   */
  locked: boolean
}

/** Mirror state every derived settings surface renders from. */
export interface SettingsMirrorSnapshot {
  /**
   * `ready` persists across later failed refreshes (the held view keeps serving);
   * `idle` means no answer is held and no read is running, so `ensure` will
   * start one.
   */
  status: 'idle' | 'loading' | 'ready'
  /** The last good answer; undefined until the first success. */
  view: SettingsDescribeView | undefined
  /** The latest refresh failure message, cleared by the next success. */
  error: string | null
  /**
   * Whether the settings gate is locked for this peer, as the Host last
   * reported it in `locked` on a `settings.describe` answer. Reads are never
   * refused by the gate — only writes are — so this tracks the wire field, not
   * a failure. While true, a derived surface renders its unlock prompt instead
   * of the held view; it clears on the next read that reports an accepted
   * unlock and re-arms at each UTC hour boundary (when the Host's fact
   * expires).
   */
  locked: boolean
}

/**
 * The mirror as cross-namespace surfaces consume it: current answer,
 * subscription, first-use read, and the write-answer fold. `load` stays off
 * this face — invalidation refreshes belong to the mirror's owning plugin.
 */
export interface SettingsDescribeFace {
  /** @returns the current sync snapshot (stable reference until the next change). */
  getSnapshot(): SettingsMirrorSnapshot
  /**
   * Observe snapshot replacements.
   * @param listener - invoked after each snapshot change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void
  /**
   * Resolve once an answer is held, reading only from `idle`. A settled mirror
   * holds either a view or the read's error.
   * @returns settlement of the current or newly started read, if any.
   */
  ensure(): Promise<void>
  /**
   * Fold one write answer's namespace view into the held view without a wire
   * read, invalidating any older read still in flight.
   * @param view - the namespace view a settings write answered with.
   */
  acceptView(view: SettingsNamespaceView): void
  /**
   * Offer the current settings password to the Host gate. The Host re-locks on
   * its own schedule, so this unlocks only until the next UTC hour boundary or
   * the peer's connection closes.
   * @param password - the password the user entered.
   * @returns true when the Host accepted and the mirror is no longer locked;
   * false when the password was refused (the Host reports one refusal for both
   * a not-owner caller and a wrong password, so no reason leaks to the UI).
   */
  unlock(password: string): Promise<boolean>
}

/**
 * Serializes every Host `settings.describe` read behind one snapshot store.
 * Concurrent {@link load} calls fold into the in-flight read plus one rerun,
 * so an invalidation arriving mid-read is never lost and never duplicated.
 */
export class SettingsDescribeMirror implements SettingsDescribeFace {
  private readonly store: SnapshotStore<SettingsMirrorSnapshot>
  private inFlight: Promise<void> | undefined
  private rerun = false
  private generation = 0

  /**
   * @param ctx - the providing plugin's context, whose `remote.settings`
   * namespace answers the describe read.
   */
  constructor(private readonly ctx: ClientContext) {
    this.store = createSnapshotStore<SettingsMirrorSnapshot>({
      status: 'idle',
      view: undefined,
      error: null,
      locked: false,
    })
  }

  /** @returns the current sync snapshot (stable reference until the next change). */
  getSnapshot(): SettingsMirrorSnapshot {
    return this.store.getSnapshot()
  }

  /**
   * Observe snapshot replacements.
   * @param listener - invoked after each snapshot change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener)
  }

  /**
   * Refresh from the Host. A call during an in-flight read marks one rerun
   * after it settles instead of racing a second wire read.
   * @returns settlement after this call's freshness is reflected.
   */
  load(): Promise<void> {
    if (this.inFlight !== undefined) {
      this.rerun = true
      return this.inFlight
    }
    // Own the slot before the loading publication can synchronously reenter load().
    const run = Promise.resolve().then(() => this.run())
    this.inFlight = run
    return run
  }

  /**
   * Resolve once an answer is held, reading only from `idle`.
   * @returns settlement of the current or newly started read, if any.
   */
  ensure(): Promise<void> {
    if (this.inFlight !== undefined) return this.inFlight
    if (this.getSnapshot().status === 'idle') return this.load()
    return Promise.resolve()
  }

  /**
   * Fold one write answer's namespace view into the held view without a wire
   * read, and invalidate any read still in flight. With no held document, the
   * answer is not published as a partial document; an in-flight read reruns so
   * it cannot publish a document fetched before the write committed.
   * @param view - the namespace view a settings write answered with.
   */
  acceptView(view: SettingsNamespaceView): void {
    const before = this.store.getSnapshot()
    this.generation += 1
    if (this.inFlight !== undefined) this.rerun = true
    if (before.view === undefined) return
    const namespaces = before.view.namespaces.some(row => row.ns === view.ns)
      ? before.view.namespaces.map(row => row.ns === view.ns ? view : row)
      : [...before.view.namespaces, view]
    this.store.set({ ...before, view: { ...before.view, namespaces } })
  }

  /**
   * Convenience row lookup on the held view.
   * @param ns - namespace identity.
   * @returns the namespace view, or undefined while unanswered or unregistered.
   */
  namespace(ns: string): SettingsNamespaceView | undefined {
    return this.store.getSnapshot().view?.namespaces.find(row => row.ns === ns)
  }

  /**
   * Offer the current settings password to the Host gate, then refresh the
   * document so a successful unlock is reflected in the held view.
   * @param password - the password the user entered.
   * @returns true when the Host accepted and the mirror is no longer locked;
   * false when the password was refused (the mirror keeps serving the locked
   * prompt).
   */
  async unlock(password: string): Promise<boolean> {
    const response = await this.ctx.remote.settings.unlock(password)
    // A refusal keeps the mirror locked and reports refused; the caller's gate
    // shows the Host's single refusal and stays in place of the panel.
    if (!response.ok) return false
    // An accepted unlock clears the locked fact now, then refreshes so the
    // authoritative wire word (still unlocked until the next hour boundary)
    // stands; the gate's caller hands the shell back to the panel.
    this.store.set({ ...this.getSnapshot(), locked: false })
    await this.load()
    return true
  }

  private async run(): Promise<void> {
    // The in-flight slot must clear in the same synchronous segment that
    // observes `rerun` false (and on abrupt exit): a `.finally()` on the
    // returned promise runs one microtask later, and a `load()` landing in
    // that gap would mark a rerun nobody reads, losing the read.
    try {
      do {
        const before = this.store.getSnapshot()
        if (before.status === 'idle') this.store.set({ ...before, status: 'loading' })
        // Cleared immediately before the wire read goes out: a load() marked
        // earlier (including one reentering from the loading publish above)
        // is covered by this very read, while one landing after needs the
        // rerun.
        this.rerun = false
        const generation = ++this.generation
        let outcome: { view: SettingsDescribeView } | { failure: string }
        try {
          const response = await this.ctx.remote.settings.describe()
          outcome = response.ok
            ? { view: response.value }
            : { failure: response.error.message }
        } catch (error) {
          // Reads are never refused by the gate, so a rejection here is an
          // assembly or transport fault; the prior locked flag stands.
          outcome = { failure: error instanceof Error ? error.message : String(error) }
        }
        // A write answer invalidates a document read before that write committed.
        if (generation !== this.generation) continue
        if ('view' in outcome) {
          // The wire field is the gate's word for this peer: false once an
          // unlock is accepted, true again at each UTC hour boundary.
          this.store.set({ status: 'ready', view: outcome.view, error: null, locked: outcome.view.locked })
        } else {
          const held = this.store.getSnapshot()
          // No answer yet: fall back to idle so `ensure` retries; with one, the
          // held view keeps serving and only the error field reports the miss.
          // A failed read changes no gate state, so the flag stands as the
          // prior settled read left it.
          this.store.set({
            status: held.view === undefined ? 'idle' : 'ready',
            view: held.view,
            error: outcome.failure,
            locked: held.locked,
          })
        }
      } while (this.shouldRerun())
    } finally {
      this.inFlight = undefined
    }
  }

  private shouldRerun(): boolean {
    return this.rerun
  }
}
