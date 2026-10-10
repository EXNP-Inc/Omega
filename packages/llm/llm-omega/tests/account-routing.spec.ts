/** Account route cancellation uses the real loop, registry, and tool lifecycle. */
import { afterEach, expect, it, vi } from 'vitest'
import { installAccountTaskCancellation, type OmegaAccount } from '@omega-ai/dsh-omega-account'
import { Context } from '@omega-ai/cordis'
import LlmRuntime, { createUserMessage, LlmAdapter, type GenerateOptions, type StreamChunk, ToolCallId } from '@omega-ai/dsh-llm'
import AgentRegistry, { type Agent } from '@omega-ai/dsh-agent'
import AgentLoop from '@omega-ai/dsh-agent-loop'
import SessionStore, { SessionId } from '@omega-ai/dsh-session'
import SessionProjectionRegistry from '@omega-ai/dsh-session-projection'
import SystemPrompt from '@omega-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@omega-ai/dsh-tools'
import * as Omega from '@omega-ai/dsh-llm-omega-api-key'
import * as AccountProvider from '@omega-ai/dsh-llm-omega-account'
import { assemble } from './assemble.ts'

const contexts: Context[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

async function harness(omega: Parameters<typeof Omega.Config>[0] = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  installAccountTaskCancellation(ctx)
  for (const plugin of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry]) {
    await ctx.plugin(plugin)
  }
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(Omega, omega)
  await ctx.plugin(AccountProvider, omega)
  return ctx
}

function send(agent: Agent) {
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
}

class ScriptedAdapter extends LlmAdapter {
  constructor(private run: (request: GenerateOptions) => AsyncIterable<StreamChunk>) { super() }
  override stream(request: GenerateOptions) { return this.run(request) }
}

it('never falls back to an API key while signed out', async () => {
  vi.stubEnv('OMEGA_API_KEY', 'fixture-api-key')
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Omega, {})
  await ctx.plugin(AccountProvider, {})
  const fetch = vi.spyOn(globalThis, 'fetch')
  const result = await assemble(ctx, { provider: 'omega-account', model: 'omega-v4-flash', messages: [] })
  expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'ACCOUNT_SIGN_IN_REQUIRED' } })
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['omega-account', 'omega-official'])('cancels only the active account route during tools: %s', async (provider) => {
  const ctx = await harness()
  const toolEntered = Promise.withResolvers<undefined>()
  const release = Promise.withResolvers<undefined>()
  const adapter = new ScriptedAdapter(async function* () {
    yield { type: 'block-start', index: 0, blockType: 'tool-call' }
    yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('fixture-call'), name: 'wait', arguments: '{}' } }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  })
  ctx.on('llm/stream', request => adapter.stream(request))
  const agent = await ctx.agentLoop.create(SessionId(`tools-${provider}`), { provider, model: 'omega-v4-flash' })
  ctx.tools.register(defineContentToolFixture({ name: 'wait', description: '', parameters: {}, async execute() {
    toolEntered.resolve(undefined)
    await release.promise
    return [{ type: 'text', text: 'done' }]
  } }))
  send(agent)
  await toolEntered.promise
  expect(agent.session.requestContext()?.provider).toBe(provider)
  agent.inbox.splice('next-turn', Infinity, 0, [createUserMessage({ content: [{ type: 'text', text: 'queued' }], source: { kind: 'user' } })])
  ctx.emit('omega-account/signed-out')
  // Changing settings cannot reclassify the already running tool call.
  expect(agent.session.requestContext()?.provider).toBe(provider)
  expect(agent.inbox.nextTurn).toHaveLength(1)
  if (provider === 'omega-official') agent.cancel({ kind: 'user' }, { keepInbox: true })
  release.resolve(undefined)
  await agent.whenIdle()
  expect(agent.status).toBe('idle')
  expect(agent.inbox.nextTurn).toHaveLength(1)
  expect(agent.session.snapshotEvents().at(-1)?.data).toMatchObject({ reason: { kind: 'aborted', reason: provider === 'omega-account'
    ? { kind: 'hook', reason: 'omega-account/signed-out' } : { kind: 'user' } } })
})

it.each(['tool', 'retry'])('replaces the active provider only after the next request binds: %s', async (transition) => {
  const ctx = await harness()
  const preparing = Promise.withResolvers<undefined>()
  const proceed = Promise.withResolvers<undefined>()
  const streaming = Promise.withResolvers<AbortSignal>()
  let requests = 0
  ctx.on('agent/request', async (_event, next) => {
    const config = await next()
    if (++requests === 1) return config
    preparing.resolve(undefined)
    await proceed.promise
    return { ...config, provider: 'omega-official' }
  })
  ctx.on('agent/request-error', async (_event, next) => { await next(); return { kind: 'retry' } })
  ctx.on('llm/stream', async function* (request) {
    if (request.provider === 'omega-account') {
      if (transition === 'retry') {
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'TRANSPORT', message: 'retry fixture' } } }
        return
      }
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('switch-call'), name: 'continue', arguments: '{}' } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    const signal = request.signal!
    streaming.resolve(signal)
    await new Promise<void>((resolve) => { signal.addEventListener('abort', () => { resolve() }, { once: true }) })
    signal.throwIfAborted()
  })
  ctx.tools.register(defineContentToolFixture({ name: 'continue', description: '', parameters: {}, execute: async () => [{ type: 'text', text: 'done' }] }))
  const agent = await ctx.agentLoop.create(SessionId('switch-provider'), { provider: 'omega-account', model: 'omega-v4-flash' })
  expect(agent.session.requestContext()?.provider).toBeUndefined()
  send(agent)
  await preparing.promise
  expect(agent.session.requestContext()?.provider).toBe('omega-account')
  proceed.resolve(undefined)
  const signal = await streaming.promise
  expect(agent.session.requestContext()?.provider).toBe('omega-official')
  ctx.emit('omega-account/signed-out')
  expect(signal.aborted).toBe(false)
  agent.cancel({ kind: 'user' })
  await agent.whenIdle()
  expect(agent.status).toBe('idle')
})

it('does not infer a provider while the first request is still being prepared', async () => {
  const ctx = await harness()
  const preparing = Promise.withResolvers<undefined>()
  const proceed = Promise.withResolvers<undefined>()
  ctx.on('agent/request', async ({ signal }, next) => {
    preparing.resolve(undefined)
    await proceed.promise
    expect(signal.aborted).toBe(false)
    return next()
  })
  const agent = await ctx.agentLoop.create(SessionId('first-preparation'), { provider: 'omega-account', model: 'omega-v4-flash' })
  send(agent)
  await preparing.promise
  expect(agent.session.requestContext()?.provider).toBeUndefined()
  ctx.emit('omega-account/signed-out')
  proceed.resolve(undefined)
  await agent.whenIdle()
  expect(agent.session.snapshotEvents().at(-1)?.data).toMatchObject({ reason: { kind: 'error', error: { code: 'ACCOUNT_SIGN_IN_REQUIRED' } } })
})


it('never borrows an account token for a missing API key', async () => {
  vi.stubEnv('OMEGA_API_KEY', '')
  const ctx = new Context()
  contexts.push(ctx)
  const resolveToken = vi.fn(async (_url: string) => 'fixture-account-token')
  ctx.provide('omegaAccount', { resolveToken: (url: string): Promise<string | undefined> => resolveToken(url) } as OmegaAccount)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Omega, {})
  await ctx.plugin(AccountProvider, {})
  const fetch = vi.spyOn(globalThis, 'fetch')
  const result = await assemble(ctx, { provider: 'omega-official', model: 'omega-v4-flash', messages: [] })
  expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
  expect(resolveToken).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})


it('propagates account sign-out to the HTTP request signal', async () => {
  const ctx = await harness()
  ctx.provide('omegaAccount', { resolveToken: async (_url: string) => 'fixture-account-token' } as OmegaAccount)
  const started = Promise.withResolvers<AbortSignal>()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const signal = init!.signal!
    expect(new Headers(init!.headers).get('x-dsh-auth-token')).toBe('fixture-account-token')
    started.resolve(signal)
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => { reject(new Error('request aborted', { cause: signal.reason })) }, { once: true })
    })
  })
  const agent = await ctx.agentLoop.create(SessionId('http-abort'), { provider: 'omega-account', model: 'omega-v4-flash' })
  send(agent)
  const signal = await started.promise
  ctx.emit('omega-account/signed-out')
  await agent.whenIdle()
  expect(signal.aborted).toBe(true)
  expect(agent.session.snapshotEvents().at(-1)?.data).toMatchObject({ reason: { kind: 'aborted', reason: { kind: 'hook', reason: 'omega-account/signed-out' } } })
})


it('cancels an account child without stopping its API-key parent', async () => {
  const ctx = await harness()
  const parentStarted = Promise.withResolvers<AbortSignal>()
  const childStarted = Promise.withResolvers<AbortSignal>()
  ctx.on('llm/stream', async function* (request) {
    const signal = request.signal!
    if (request.provider === 'omega-account') childStarted.resolve(signal)
    else parentStarted.resolve(signal)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    await new Promise<void>((resolve) => { signal.addEventListener('abort', () => { resolve() }, { once: true }) })
    signal.throwIfAborted()
  })
  const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'omega-official', model: 'omega-v4-flash' })
  const childHandle = await ctx.agents.create({ sessionId: SessionId('child'), parentAgent: parent,
    agentOptions: { provider: 'omega-account', model: 'omega-v4-flash' } })
  send(parent)
  send(childHandle.agent)
  const [parentSignal, childSignal] = await Promise.all([parentStarted.promise, childStarted.promise])
  ctx.emit('omega-account/signed-out')
  await childHandle.agent.whenIdle()
  expect(childSignal.aborted).toBe(true)
  expect(parentSignal.aborted).toBe(false)
  parent.cancel({ kind: 'user' })
  await parent.whenIdle()
})

it('hides signed-out account models while retaining the official catalog without an API key', async () => {
  vi.stubEnv('OMEGA_API_KEY', '')
  // The official catalog ships empty, so the test supplies the entry it retains.
  const ctx = await harness({ models: [{ id: 'official-model' }] })
  let token: string | undefined
  ctx.provide('omegaAccount', { resolveToken: async (url: string) => new URL(url).origin === 'http://127.0.0.1:8090' ? token : undefined } as OmegaAccount)
  expect(await ctx.llm.listModels('omega-account')).toEqual([])
  expect(await ctx.llm.listModels('omega-official')).not.toHaveLength(0)
  token = 'fixture-account-token'
  expect(await ctx.llm.listModels('omega-account')).not.toHaveLength(0)
  expect(await ctx.llm.listModels('omega-official')).not.toHaveLength(0)
  vi.stubEnv('OMEGA_API_KEY', 'fixture-key')
  expect(await ctx.llm.listModels('omega-official')).not.toHaveLength(0)
  token = undefined
  expect(await ctx.llm.listModels('omega-account')).toEqual([])
  expect(await ctx.llm.listModels('omega-official')).not.toHaveLength(0)
})

it('surfaces credential storage failures during catalog discovery', async () => {
  const ctx = await harness()
  ctx.provide('omegaAccount', { resolveToken: async (_url: string): Promise<string | undefined> => { throw new Error('storage unavailable') } } as OmegaAccount)
  await expect(ctx.llm.listModels('omega-account')).rejects.toThrow('storage unavailable')
})

it('ignores idle account history but uses the last bound route during a new turn preparation', async () => {
  const ctx = await harness()
  ctx.on('llm/stream', async function* () {
    yield { type: 'finish', reason: { kind: 'stop' } }
  })
  const agent = await ctx.agentLoop.create(SessionId('previous-account-turn'), { provider: 'omega-account', model: 'omega-v4-flash' })
  send(agent)
  await agent.whenIdle()
  const cancel = vi.spyOn(agent, 'cancel')
  ctx.emit('omega-account/signed-out')
  expect(cancel).not.toHaveBeenCalled()
  const preparing = Promise.withResolvers<undefined>()
  const proceed = Promise.withResolvers<undefined>()
  ctx.on('agent/request', async (_event, next) => {
    const config = await next()
    preparing.resolve(undefined)
    await proceed.promise
    return { ...config, provider: 'omega-official' }
  })
  try {
    send(agent)
    await preparing.promise
    ctx.emit('omega-account/signed-out')
    expect(cancel).toHaveBeenCalledExactlyOnceWith(
      { kind: 'hook', reason: 'omega-account/signed-out' }, { keepInbox: true },
    )
  } finally {
    proceed.resolve(undefined)
    await agent.whenIdle()
  }
})

it('records a signed-out request failure and publishes sign-in guidance', async () => {
  const ctx = await harness()
  const guidance = vi.fn()
  ctx.on('omega-account/model-sign-in-required', guidance)
  const agent = await ctx.agentLoop.create(SessionId('signed-out-send'), { provider: 'omega-account', model: 'omega-v4-flash' })
  send(agent)
  await agent.whenIdle()
  expect(agent.session.snapshotEvents().at(-1)?.data).toMatchObject({
    reason: { kind: 'error', error: { code: 'ACCOUNT_SIGN_IN_REQUIRED' } },
  })
  expect(guidance).toHaveBeenCalledOnce()
})
