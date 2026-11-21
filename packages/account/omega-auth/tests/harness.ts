/** A context with the Omega authentication service over stand-in credential planes. */
import { Context } from '@omega-ai/cordis'
import OmegaAuth, { type OmegaAuthCandidate, type OmegaAuthRequest, type OmegaAuthUnresolved } from '@omega-ai/dsh-omega-auth'
import type { OmegaAccount } from '@omega-ai/dsh-omega-account'
import { DSH_LAUNCH_ENVIRONMENT_KEY, createLaunchEnvironmentSnapshot } from '@omega-ai/dsh-launch-environment'

/** Credential planes of one test context. */
export interface Planes {
  /** Launch-environment variables. */
  environment?: Record<string, string>
  /** Values of the mounted credentials service by reference; omitted mounts no service. */
  stored?: Record<string, string>
  /** Account service stand-in. */
  account?: OmegaAccount
}

const mounted: Context[] = []

/** Dispose every context {@link mount} created. */
export async function disposeMounted(): Promise<void> {
  await Promise.all(mounted.splice(0).map(ctx => ctx.fiber.dispose()))
}

/**
 * Mount the service.
 * @param planes - the credential planes it reads.
 * @returns the context.
 */
export async function mount(planes: Planes = {}): Promise<Context> {
  const ctx = new Context()
  mounted.push(ctx)
  ctx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, createLaunchEnvironmentSnapshot([{ source: 'process', values: planes.environment ?? {} }]))
  const { stored } = planes
  if (stored !== undefined) {
    ctx.provide('credentials', {
      resolve: (ref: string) => Promise.resolve(stored[ref] === undefined ? undefined : { value: stored[ref] }),
      describe: (ref: string) => Promise.resolve({ configured: (stored[ref]?.length ?? 0) > 0 }),
    } as never)
  }
  if (planes.account !== undefined) ctx.provide('omegaAccount', planes.account)
  await ctx.plugin(OmegaAuth)
  return ctx
}

/** A request to the Search API accepting both kinds, with overrides. */
export function request(overrides: Partial<OmegaAuthRequest> = {}): OmegaAuthRequest {
  return { consumer: 'web-test', accepts: ['account', 'api-key'], destination: { path: '/v1/tools/search' }, ...overrides }
}

/** Each entry as `kind endpoint`, or `kind !unresolved` for an unresolved kind. */
export function summary(entries: readonly (OmegaAuthCandidate | OmegaAuthUnresolved)[]): string[] {
  return entries.map(entry => 'unresolved' in entry ? `${entry.kind} !${entry.unresolved}` : `${entry.kind} ${entry.endpoint}`)
}

/** Narrow an entry to a candidate, failing the test for an unresolved kind. */
export function candidate(entry: OmegaAuthCandidate | OmegaAuthUnresolved | undefined): OmegaAuthCandidate {
  if (entry === undefined || 'unresolved' in entry) throw new Error('expected a candidate')
  return entry
}
