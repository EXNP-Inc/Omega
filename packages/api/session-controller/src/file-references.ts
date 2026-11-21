/** Session Controller adapter for Agent-scoped file-reference discovery. */

import type { Context } from '@omega-ai/cordis'
import type { Agent } from '@omega-ai/dsh-agent'
import type {} from '@omega-ai/dsh-file-reference'
import type { FileReferenceCandidate } from '@omega-ai/dsh-file-reference/types'
import { Remote, TypertRemoteService } from '@omega-ai/dsh-typert-protocol'

declare module '@omega-ai/cordis' {
  interface Context {
    /** Host owner of the `fileReferences` Remote namespace. */
    sessionFileReferences: SessionFileReferences
  }
}

/** Host Remote adapter over the composed file-reference provider. */
export class SessionFileReferences extends TypertRemoteService {
  static inject = ['fileReferences', 'typert']

  /** @param ctx - Host context carrying the selected file-reference provider. */
  constructor(ctx: Context) {
    super(ctx, 'sessionFileReferences', { namespace: 'fileReferences' })
  }

  /**
   * List file and directory candidates for one Agent's working directory.
   * @param agent - target Agent resolved from the Session identity on the wire.
   * @param query - path text following `@` or `@"`.
   * @param signal - caller cancellation.
   * @returns deterministic path-only candidates from the composed provider.
   */
  @Remote
  list(
    agent: Agent,
    query: string,
    signal: AbortSignal,
  ): Promise<FileReferenceCandidate[]> {
    return this.ctx.fileReferences.list(agent, query, signal)
  }
}

export default SessionFileReferences
