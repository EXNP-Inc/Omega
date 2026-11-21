/** Where a credential may be sent: absolute destinations, and the deployment of a kind no model route connected. */
import { afterEach, describe, expect, it } from 'vitest'
import { disposeMounted, mount, request, summary } from './harness.ts'

afterEach(disposeMounted)

describe('absolute destinations', () => {
  const ROUTE = 'https://route.omega.test/anthropic'

  it('offers a kind for a URL under the origin of its deployment', async () => {
    const ctx = await mount()
    ctx.effect(() => ctx.omegaAuth.connect('api-key', 'omega-official', () => ({ baseURL: ROUTE })))
    const url = 'https://route.omega.test/anthropic/v1/models'
    expect(summary(ctx.omegaAuth.candidates(request({ billing: 'api-key', destination: { url } })))).toEqual([`api-key ${url}`])
  })

  it.each([
    'https://other.omega.test/anthropic/v1/models',
    'http://route.omega.test/anthropic/v1/models',
    'https://user:secret@route.omega.test/anthropic/v1/models',
  ])('offers no kind for %s, which is outside the deployment or embeds credentials', async (url) => {
    const ctx = await mount()
    ctx.effect(() => ctx.omegaAuth.connect('api-key', 'omega-official', () => ({ baseURL: ROUTE })))
    expect(ctx.omegaAuth.candidates(request({ billing: 'api-key', destination: { url } }))).toEqual([])
  })

  it('marks a kind unresolved for a destination that is no URL', async () => {
    const ctx = await mount()
    expect(ctx.omegaAuth.candidates(request({ billing: 'api-key', destination: { url: 'not a url' } })))
      .toMatchObject([{ kind: 'api-key', unresolved: 'connection' }])
  })
})

describe('the account deployment without a connected account route', () => {
  it.each([[{}], [{ OMEGA_BASE_URL: '' }]])('is the official API for environment %j', async (environment) => {
    const ctx = await mount({ environment })
    expect(summary(ctx.omegaAuth.candidates(request({ billing: 'account' })))).toEqual(['account https://api.omega.com/v1/tools/search'])
  })

  it('is the origin OMEGA_BASE_URL names', async () => {
    const ctx = await mount({ environment: { OMEGA_BASE_URL: 'https://gateway.omega.test/anthropic' } })
    expect(summary(ctx.omegaAuth.candidates(request({ billing: 'account' })))).toEqual(['account https://gateway.omega.test/v1/tools/search'])
  })

  it.each(['not a url', 'ftp://gateway.omega.test', 'https://user:secret@gateway.omega.test'])(
    'is unresolved for OMEGA_BASE_URL=%s, naming the deployment', async (value) => {
      const ctx = await mount({ environment: { OMEGA_BASE_URL: value } })
      const [entry] = ctx.omegaAuth.candidates(request({ billing: 'account' }))
      expect(entry).toMatchObject({ kind: 'account', unresolved: 'deployment' })
      expect(entry).toHaveProperty('error', expect.any(Error))
    })

  it('does not move the API key, which stays at the official API', async () => {
    const ctx = await mount({ environment: { OMEGA_BASE_URL: 'https://gateway.omega.test/anthropic' } })
    expect(summary(ctx.omegaAuth.candidates(request({ billing: 'api-key' })))).toEqual(['api-key https://api.omega.com/v1/tools/search'])
  })
})
