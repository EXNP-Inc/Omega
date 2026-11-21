import { describe, expect, it } from 'vitest'
import { Context } from '@omega-ai/cordis'
import SessionStore, { type SessionId } from '@omega-ai/dsh-session'
import TypertRegistry from '@omega-ai/dsh-typert-registry'
import { brandString } from '@omega-ai/dsh-brand'

describe('Session Typert provider', () => {
  it('contributes live Session lookup in either service load order', async () => {
    const ctx = new Context()
    const sessionFiber = ctx.plugin(SessionStore)
    await sessionFiber
    await ctx.plugin(TypertRegistry)
    const session = ctx.sessions.create(brandString<SessionId>('remote-session'))

    const lookup = ctx.typert.lookups.get('session')
    expect(lookup).toMatchObject({
      parameter: 'session',
      wire: 'sessionId',
      resource: 'session',
      hostTypeSymbol: '@omega-ai/dsh-session#Session',
      wireTypeSymbol: '@omega-ai/dsh-session/types#SessionId',
    })
    expect(lookup?.resolve(session.id)).toBe(session)

    await sessionFiber.dispose()
    expect(ctx.typert.lookups.get('session')).toBeUndefined()
  })
})
