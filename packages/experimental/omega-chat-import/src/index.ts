/**
 * Host plugin importing a Omega chat export (chat.omega.com
 * `omega_data-*.zip`) uploaded by the browser as stored DSH Sessions in a
 * chosen Workspace. The upload is processed in memory and never written to disk.
 * @module @omega-ai/dsh-omega-chat-import
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@omega-ai/cordis'
import Schema from '@omega-ai/schemastery'
import { principalOf, Remote, RemoteError, TypertRemoteService } from '@omega-ai/dsh-typert-protocol'
import type {} from '@omega-ai/dsh-attachment'
import type {} from '@omega-ai/dsh-client-connection'
import type {} from '@omega-ai/dsh-session-persistence'
import type {} from '@omega-ai/dsh-session-projection-cache'
import type {} from '@omega-ai/dsh-workspace'
import type { WorkspaceId } from '@omega-ai/dsh-workspace/types'
import { importOmegaChatExport } from './importer.ts'
import { UPLOAD_PATH } from './protocol.ts'
import { createUploadRoute } from './upload.ts'
import type { ImportClaim } from './upload.ts'
import type { OmegaChatImportLimits } from './types.ts'

export { ExportEntryError, ExportSourceError } from './archive.ts'
export { ExportConversationError } from './conversation.ts'
export type { ExportArchive } from './archive.ts'
export type { ConvertConversationOptions, ConvertedConversation } from './conversation.ts'
export type { OmegaChatImportDependencies, OmegaChatImportRequest, OmegaChatImportWorkspace } from './importer.ts'
export type { ImportClaim, UploadRouteHandler } from './upload.ts'
export type {
  OmegaChatImportFailureReason, OmegaChatImportLimits, OmegaChatImportLine, OmegaChatImportResponse, OmegaChatImportResult,
  OmegaChatImportSkip,
} from './types.ts'

/** Deployment limits of the importer. */
export interface Config {
  /** Most Sessions one import writes, choosing the conversations the export index lists as most recently updated. */
  maxSessions: number
  /** Largest export archive, in bytes, one upload may carry; the whole archive is held in memory while it is imported. */
  maxUploadBytes: number
  /** Largest declared uncompressed size, in bytes, of one archive entry; larger entries are not decompressed. */
  maxEntryBytes: number
  /** Largest UTF-8 size, in bytes, of an imported title, matching the session-title service's limit of the composition. */
  maxTitleBytes: number
}

declare module '@omega-ai/cordis' {
  interface Context {
    /** Upload route and Remote limits of the Omega chat export importer. */
    omegaChatImport: OmegaChatImportService
  }
}

/** Serves the owner-only export upload route and the limits the browser checks first. */
export default class OmegaChatImportService extends TypertRemoteService {
  static inject = ['typert', 'connection', 'sessionPersistence', 'workspaceRegistry']
  static Config: Schema<Config> = Schema.object({
    maxSessions: Schema.natural().min(1).default(1000)
      .description('Most Sessions one import writes, choosing the conversations the export index lists as most recently updated.'),
    maxUploadBytes: Schema.natural().min(1).default(512 * 1024 * 1024)
      .description('Largest export archive, in bytes, one upload may carry; the whole archive is held in memory while it is imported.'),
    maxEntryBytes: Schema.natural().min(1).default(256 * 1024 * 1024)
      .description('Largest declared uncompressed size, in bytes, of one archive entry; larger entries are not decompressed.'),
    maxTitleBytes: Schema.natural().min(1).default(80)
      .description('Largest UTF-8 size, in bytes, of an imported title; keep it equal to the session-title maxTitleBytes.'),
  })

  /** The running import, which owns the single import slot. */
  private active: { readonly controller: AbortController; readonly settled: Promise<void> } | undefined

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'omegaChatImport', { namespace: 'omegaChatImport' })
    const route = createUploadRoute({
      maxUploadBytes: config.maxUploadBytes,
      claim: () => this.claim(),
      // The registry lookup validates the wire id; an unknown id answers undefined.
      workspace: id => ctx.workspaceRegistry.get(id as WorkspaceId),
      import: (archive, workspace, onProgress, signal) => importOmegaChatExport({
        persistence: ctx.sessionPersistence,
        projectionCache: ctx.get('sessionProjectionCache'),
        attachments: ctx.get('attachments'),
        workspaceRegistered: id => ctx.workspaceRegistry.get(id as WorkspaceId) !== undefined,
        createId: () => randomUUID(),
        warn: (message) => { ctx.logger.warn(message) },
      }, {
        archive,
        workspace,
        limits: { maxSessions: config.maxSessions, maxEntryBytes: config.maxEntryBytes, maxTitleBytes: config.maxTitleBytes },
        onProgress,
      }, signal),
      failed: (error) => { ctx.logger.error('omega-chat-import: import failed', error) },
    })
    ctx.effect(
      () => ctx.connection.fetch.register({ path: UPLOAD_PATH, methods: ['POST'], requestBody: 'streaming', fetch: route }),
      'omega-chat-import: upload route',
    )
    ctx.effect(() => async () => {
      // Unloading cancels the running import and completes only after it stops writing.
      this.active?.controller.abort()
      await this.active?.settled
    }, 'omega-chat-import: running import')
  }

  /**
   * Report the limits the browser checks before uploading. Only the owner may
   * import, so every other principal is refused.
   * @param signal - Client cancellation or Remote withdrawal.
   * @returns the largest accepted archive size.
   * @throws {RemoteError} `omegaChatImport/owner-only` for a caller that is not the owner.
   */
  @Remote
  limits(signal: AbortSignal): OmegaChatImportLimits {
    signal.throwIfAborted()
    if (principalOf(this.ctx.invocation) !== undefined) {
      throw new RemoteError('omegaChatImport/owner-only', 'only the owner may import Omega chat exports', {})
    }
    return { maxUploadBytes: this.config.maxUploadBytes }
  }

  private claim(): ImportClaim | undefined {
    if (this.active !== undefined) return undefined
    const controller = new AbortController()
    const { promise: settled, resolve: settle } = Promise.withResolvers<void>()
    this.active = { controller, settled }
    return {
      signal: controller.signal,
      release: () => {
        this.active = undefined
        settle()
      },
    }
  }
}
