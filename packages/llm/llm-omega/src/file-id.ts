/** Omega Files API identifiers. @module dsh-llm-omega/file-id */

import type { Branded } from '@omega-ai/dsh-brand'

/** Opaque identifier returned by the Omega Files API. */
export type OmegaFileId = Branded<'OmegaFileId'>

/**
 * Brand a provider-returned file identifier after wire validation.
 * @param id - non-empty Files API identifier.
 * @returns the same string with its provider identity attached at type level.
 */
export function OmegaFileId(id: string): OmegaFileId {
  return id as OmegaFileId
}

/** Non-secret digest identifying one endpoint and API-key file namespace. */
export type OmegaFileScope = Branded<'OmegaFileScope'>

/**
 * Brand a locally derived namespace digest.
 * @param scope - SHA-256 digest of endpoint and API key.
 * @returns the same string with namespace identity attached at type level.
 */
export function OmegaFileScope(scope: string): OmegaFileScope {
  return scope as OmegaFileScope
}
