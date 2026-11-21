/** Browser half: the import action after New session and its Remote calls. */
import type { Context } from '@omega-ai/cordis'
import remote from '@omega-ai/dsh-omega-chat-import/remote'
import { mountImport } from './mount.ts'
import type { OmegaChatImportKey } from './locales.ts'

export { inject } from './mount.ts'
export type { OmegaChatImportInjected, OmegaChatImportOutcome, ImportSessionsActionProps } from './ImportSessions.tsx'
export type { OmegaChatImportKey } from './locales.ts'

declare module '@omega-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Omega chat export import action and dialog copy. */
    omegaChatImport: OmegaChatImportKey
  }
}

/**
 * Mount the import action and its Remote methods.
 * @param ctx - browser plugin context.
 * @returns disposer joining UI and Remote withdrawal.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  return await mountImport(ctx, remote)
}
