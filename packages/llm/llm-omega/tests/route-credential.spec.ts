/** The adapter refuses a request whose provider releases no credential, with the provider's diagnostic when it names one. */
import { afterEach, expect, it, vi } from 'vitest'
import { LlmError } from '@omega-ai/dsh-llm'
import type { AnonymousUserId } from '@omega-ai/dsh-anonymous-user-id'
import { OmegaAdapter, resolveAdapterOptions } from '../src/index.ts'
import type { OmegaAdapterOptions } from '../src/index.ts'
import { chunks, options as request, prepareExtensions } from './helpers.ts'

afterEach(() => { vi.unstubAllGlobals() })

const connection = () => resolveAdapterOptions({ baseURL: 'https://route.omega.test/anthropic' })

/** A direct adapter without a credential, failing requests through `missingCredential` when given. */
function adapterWithout(missingCredential?: OmegaAdapterOptions['missingCredential']): OmegaAdapter {
  return new OmegaAdapter({
    options: connection,
    resolveAuth: () => Promise.resolve(undefined),
    resolveUserId: () => 'fixture-user' as AnonymousUserId,
    prepareExtensions,
    ...missingCredential === undefined ? {} : { missingCredential },
  })
}

it('fails a request without a credential before any network I/O, with the default diagnostic', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await expect(chunks(adapterWithout().stream(request({ provider: 'fixture-route' })))).rejects.toMatchObject({
    code: 'MISSING_CREDENTIAL', message: 'llm-omega: no credential for provider route "fixture-route"',
  })
  expect(fetchMock).not.toHaveBeenCalled()
})

it('fails a request without a credential with the provider\'s own diagnostic', async () => {
  vi.stubGlobal('fetch', vi.fn())
  const missing = adapterWithout((_connection, provider) => new LlmError(`sign in for ${provider}`, 'ACCOUNT_SIGN_IN_REQUIRED'))
  await expect(chunks(missing.stream(request({ provider: 'fixture-route' })))).rejects.toMatchObject({
    code: 'ACCOUNT_SIGN_IN_REQUIRED', message: 'sign in for fixture-route',
  })
})
