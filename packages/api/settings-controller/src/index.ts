/**
 * Host Remote owner for the configuration surfaces over the settings-domain
 * seams. Two namespaces: `settings`, the redacted reads and writes of
 * `ctx.settings`, owned by the class below; and `credentials`, mounted from
 * here as its own plugin.
 *
 * @module @omega-ai/dsh-api-settings-controller
 */

import { Context } from '@omega-ai/cordis'
import {
  openNativeTextFile,
} from '@omega-ai/dsh-native-command'
import type { SettingsDescriptor, SettingsPathOp, SettingsForms } from '@omega-ai/dsh-settings'
import type {
  SettingsDescribeValue, SettingsNamespaceView, SettingsPathOpView,
} from '@omega-ai/dsh-settings/types'
import { Remote, RemoteError, TypertRemoteService } from '@omega-ai/dsh-typert-protocol'
import type { JsonValue } from '@omega-ai/dsh-util-values'
import { z } from 'zod'
import { CredentialsController } from './credentials.ts'
import { SettingsGate, settingsWriteExemptFromGate } from './settings-gate.ts'
import type { SettingsDocumentOpenValue } from './types.ts'

export { CredentialsController } from './credentials.ts'
export { SettingsGate, settingsUnlockPassword, settingsWriteExemptFromGate } from './settings-gate.ts'
export type * from './types.ts'

const settingsNamespaceRequestSchema = z.object({ ns: z.string().min(1) })

/** Read abort state afresh after an awaited provider or opener call. */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted
}

/** Host integrations replaceable by direct unit tests. */
export interface SettingsControllerInternals {
  /** Host text-editor integration used to open the settings document. */
  readonly openTextFile?: (path: string, signal: AbortSignal) => Promise<void>
  /** The unlock gate; the controller owns it and shares it with the credentials namespace. */
  readonly gate?: SettingsGate
  /** Clock the gate reads for the rolling password; injectable so tests can advance the hour. */
  readonly now?: () => Date
}

/**
 * Project one redacted descriptor onto its wire view, field by field. The
 * Gateway returns a business result without decoding it, so a provider whose
 * descriptor carried extra enumerable properties would otherwise serialize them
 * to the caller.
 * @param descriptor - one descriptor read under `redactSecrets`.
 * @returns the same facts with nothing else attached.
 */
function namespaceView(descriptor: SettingsDescriptor): SettingsNamespaceView {
  return {
    ns: String(descriptor.ns),
    autoGenerate: descriptor.autoGenerate,
    schema: descriptor.schema as JsonValue,
    value: descriptor.value as JsonValue,
    ...descriptor.base === undefined ? {} : { base: descriptor.base as JsonValue },
    ...descriptor.user === undefined ? {} : { user: descriptor.user as JsonValue },
    applies: descriptor.applies,
    secrets: (descriptor.secrets ?? []).map(secret => ({ path: [...secret.path], set: secret.set })),
    revision: descriptor.revision,
  }
}

declare module '@omega-ai/cordis' {
  interface Context {
    /** Host owner of the `settings` Remote namespace. */
    settingsController: SettingsController
  }
}

/**
 * Host service backing the generated `ctx.remote.settings` namespace. Every
 * remote read uses `redactSecrets: true`, so a `role('secret')` field cannot
 * ride a response. Writes expose the settings service's merge, replacement,
 * and path-addressed operations, and classify every provider refusal as
 * `settings/conflict` or `settings/rejected` with the service's message.
 *
 * Writes are locked behind a server-side password: a browser peer (one whose
 * call carries an `invocation.peer`) must first call `unlock` with the current
 * UTC-rolling password, or every write (`update`, `replace`, `mutate`,
 * `openSettingsDocument`) and credentials write answers `settings/locked`.
 * The sole exemption is the volatile `ui-settings-general` namespace, which
 * carries only the boot-level onboarding acknowledgement: a first-run client
 * must be able to dismiss that notice and reach the unlock before it ever
 * knows the password, and the field holds no sensitive value. Reads are never
 * locked — `describe` returns redacted, secret-free values plus the caller's
 * gate state in its `locked` field — so a locked page renders and offers the
 * unlock instead of failing at boot. In-process callers arrive with no peer
 * and are never locked. The `credentials` namespace shares the same gate, so
 * one unlock clears both, and credentials writes stay gated by the password.
 */
export class SettingsController extends TypertRemoteService {
  private readonly openTextFile: (path: string, signal: AbortSignal) => Promise<void>

  private readonly gate: SettingsGate

  /**
   * Register the settings namespace and mount the credentials namespace beside
   * it. Both namespaces stay registered when a provider is absent so calls can
   * return the configuration API's actionable missing-provider diagnostic. The
   * controller owns the unlock gate and hands it to the credentials namespace
   * so a single password unlocks both together.
   * @param ctx - Host context where settings and credential providers may be mounted.
   * @param internals - host integrations: the text opener, the gate, and the
   *   gate's clock.
   */
  constructor(ctx: Context, internals: SettingsControllerInternals = {}) {
    super(ctx, 'settingsController', { namespace: 'settings' })
    this.openTextFile = internals.openTextFile ?? openNativeTextFile
    this.gate = internals.gate ?? new SettingsGate(internals.now)
    ctx.plugin(CredentialsController, { gate: this.gate })
  }

  /**
   * Describe every registered namespace for a configuration page: redacted
   * layered values plus the serialized schema the page renders its form from.
   * This read is never locked — it answers redacted, secret-free values and the
   * caller's own gate state in `locked`, so a locked page still renders and
   * offers the unlock instead of a failure; only the writes gate below the
   * password.
   * @returns provider writability, local-document presence, the caller's gate
   *   state, and one view per namespace.
   * @throws RemoteError when no settings provider is mounted.
   */
  @Remote
  describe(): SettingsDescribeValue {
    const settings = this.provider()
    const peer = this.ctx.invocation?.peer
    return {
      writable: settings.writable,
      hasDocument: true,
      locked: peer === undefined ? false : !this.gate.isUnlocked(peer),
      namespaces: settings.describe({ redactSecrets: true }).map(namespaceView),
    }
  }

  /**
   * Merge a patch into one namespace's stored user section.
   * @param ns - namespace key to write.
   * @param patch - fields to merge into the user section.
   * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
   * @returns the namespace's redacted view after the write.
   * @throws RemoteError when the request is invalid, no provider is mounted, the
   *   provider refuses the write, or the caller's peer holds no fresh unlock fact
   *   (`settings/locked`).
   */
  @Remote
  update(
    ns: string,
    patch: Record<string, JsonValue>,
    expectedRevision: number | undefined,
  ): Promise<SettingsNamespaceView> {
    return this.write(ns, 'update', patch, expectedRevision)
  }

  /**
   * Replace one namespace's stored user section wholesale.
   * @param ns - namespace key to write.
   * @param section - complete replacement user section.
   * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
   * @returns the namespace's redacted view after the write.
   * @throws RemoteError when the request is invalid, no provider is mounted, the
   *   provider refuses the write, or the caller's peer holds no fresh unlock fact
   *   (`settings/locked`).
   */
  @Remote
  replace(
    ns: string,
    section: Record<string, JsonValue>,
    expectedRevision: number | undefined,
  ): Promise<SettingsNamespaceView> {
    return this.write(ns, 'replace', section, expectedRevision)
  }

  /**
   * Apply path-addressed edits to one namespace's user section, resolved against
   * the section as stored rather than against whatever the caller last read,
   * then answer with that namespace's new redacted view.
   * @param ns - namespace key to write.
   * @param ops - the edits to apply, in order.
   * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
   * @returns the namespace's redacted view after the write.
   * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
   */
  @Remote
  async mutate(
    ns: string,
    ops: SettingsPathOpView[],
    expectedRevision: number | undefined,
  ): Promise<SettingsNamespaceView> {
    return this.write(ns, 'mutate', ops, expectedRevision)
  }

  /**
   * Materialize the provider-owned settings document and open it in a native text editor.
   * @param signal - caller lifetime; abort terminates preparation or the native command.
   * @returns confirmation after the native opener accepts the document.
   * @throws RemoteError when no document exists, preparation fails, or opening fails.
   */
  @Remote
  async openSettingsDocument(signal: AbortSignal): Promise<SettingsDocumentOpenValue> {
    this.gate.requireUnlocked(this.ctx.invocation?.peer)
    const settings = this.provider()
    if (isAborted(signal)) throw new RemoteError('gateway/cancelled', 'settings document open was aborted', {})
    let path: string
    try {
      path = await settings.prepareDocument()
    } catch (error: unknown) {
      if (isAborted(signal)) throw new RemoteError('gateway/cancelled', 'settings document preparation was aborted', {})
      throw new RemoteError('gateway/internal', `settings document preparation failed: ${messageOf(error)}`, {}, { cause: error })
    }
    if (isAborted(signal)) throw new RemoteError('gateway/cancelled', 'settings document open was aborted', {})
    try {
      await this.openTextFile(path, signal)
      return { opened: true }
    } catch (error: unknown) {
      if (isAborted(signal)) throw new RemoteError('gateway/cancelled', 'settings document open was aborted', {})
      throw new RemoteError('gateway/internal', `path open failed: ${messageOf(error)}`, {}, { cause: error })
    }
  }

  /**
   * Enter the current password to unlock the settings and credentials
   * namespaces for this connection. This is the only method that needs no
   * prior unlock. The password is checked only on the Host in constant time
   * against the UTC day and hour of the moment of entry, so a tampered client
   * cannot learn or bypass it, and it changes every UTC hour so a successful
   * unlock re-locks on the next hour boundary. Only the owner peer may unlock;
   * every failure — not the owner, or a wrong password — answers the same
   * refusal, so a caller learns only that the password was not accepted.
   * @param password - the entered password, `fidelio` plus the 2-digit UTC day
   *   and 2-digit UTC 24h hour at the moment of entry.
   * @returns confirmation that the caller's unlock fact was recorded.
   * @throws RemoteError `settings/rejected` when the caller is not the owner or
   *   the password does not match the current UTC hour's password.
   */
  @Remote
  unlock(password: string): { readonly unlocked: true } {
    const peer = this.ctx.invocation?.peer
    if (peer === undefined || peer.principal.kind !== 'owner') {
      throw new RemoteError('settings/rejected', 'settings unlock requires the owner', { ns: 'settings' })
    }
    if (!this.gate.unlock(peer, password)) {
      throw new RemoteError('settings/rejected', 'the password was not accepted', { ns: 'settings' })
    }
    return { unlocked: true }
  }

  private async write(
    ns: string,
    mode: 'update' | 'replace' | 'mutate',
    input: Record<string, JsonValue> | SettingsPathOpView[],
    expectedRevision: number | undefined,
  ): Promise<SettingsNamespaceView> {
    const parsed = settingsNamespaceRequestSchema.safeParse({ ns })
    if (!parsed.success) {
      throw new RemoteError('gateway/bad-request', `invalid payload for settings.${mode}`, { issues: parsed.error.issues })
    }
    // The volatile onboarding-ack namespace stays writable from a locked peer so
    // a first-run client can dismiss the boot notice and reach the unlock; every
    // other namespace, and every credentials write, still requires the fact.
    if (!settingsWriteExemptFromGate(parsed.data.ns)) {
      this.gate.requireUnlocked(this.ctx.invocation?.peer)
    }
    const settings = this.provider()
    const namespace = parsed.data.ns
    try {
      if (mode === 'update') await settings.update(namespace, input, expectedRevision)
      else if (mode === 'replace') await settings.replace(namespace, input, expectedRevision)
      else await settings.mutate(namespace, input as SettingsPathOp[], expectedRevision)
    } catch (error: unknown) {
      throw rejected(ns, error)
    }
    const descriptor = settings.describe({ redactSecrets: true }).find(candidate => candidate.ns === namespace)
    if (descriptor === undefined) {
      // The write committed but the namespace vanished before this read: only a
      // concurrent registrant disposal can produce it.
      throw new RemoteError('gateway/internal', `settings namespace "${ns}" was disposed after the ${mode}`, {})
    }
    return namespaceView(descriptor)
  }

  /** Resolve the optional provider or report how to supply it. */
  private provider(): SettingsForms {
    const settings = this.ctx.get('settings')
    if (settings === undefined) {
      throw new RemoteError(
        'gateway/internal',
        'settings service is absent: mount @omega-ai/dsh-settings with @omega-ai/dsh-config-editor in the profile composition',
        {},
      )
    }
    return settings
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface SettingsConflict {
  readonly code: 'SETTINGS_CONFLICT'
  readonly message: string
  readonly expected: number
  readonly actual: number
}

function settingsConflictOf(error: unknown): SettingsConflict | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  if (Reflect.get(error, 'code') !== 'SETTINGS_CONFLICT'
    || typeof Reflect.get(error, 'message') !== 'string'
    || typeof Reflect.get(error, 'expected') !== 'number'
    || typeof Reflect.get(error, 'actual') !== 'number') return undefined
  return error as SettingsConflict
}

/**
 * Classify one seam refusal. A stale writer is its own outcome, not a malformed
 * request: the client must re-read and re-apply rather than treat the write as
 * invalid.
 * @param ns - the namespace the write addressed.
 * @param error - whatever the seam threw.
 * @returns the failure to raise for that refusal.
 */
function rejected(ns: string, error: unknown): RemoteError {
  const conflict = settingsConflictOf(error)
  if (conflict !== undefined) {
    return new RemoteError(
      'settings/conflict',
      conflict.message,
      { ns, expected: conflict.expected, actual: conflict.actual },
      { cause: error },
    )
  }
  return new RemoteError('settings/rejected', messageOf(error), { ns }, { cause: error })
}

export default SettingsController
