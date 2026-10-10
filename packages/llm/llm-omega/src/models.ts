/** The official Omega route ships an empty model catalog. */
import type { OmegaCatalogModel } from './types.ts'

/**
 * Advisory model entries for the official Omega route. The catalog ships empty:
 * the deployment supplies models through configuration, matching whatever the
 * local gateway at the configured endpoint serves.
 */
export const DEFAULT_MODELS: OmegaCatalogModel[] = []
