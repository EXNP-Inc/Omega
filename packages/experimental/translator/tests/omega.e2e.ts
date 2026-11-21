/** Explicitly enabled billed Flash smoke through the actual native official provider. */
import type { ModuleLoaderV2 } from '@omega-ai/cordis-plugin-loader'
import { boot } from '@omega-ai/dsh-app-boot'
import LlmRuntime from '@omega-ai/dsh-llm'
import SessionStore, { type SessionId } from '@omega-ai/dsh-session'
import * as JsonlPersistence from '@omega-ai/dsh-session-persistence-jsonl'
import * as Official from '@omega-ai/dsh-llm-omega-api-key'
import OmegaAuth from '@omega-ai/dsh-omega-auth'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import Translator from '../src/index.ts'
import { brandString } from '@omega-ai/dsh-brand'

const enabled = process.env.DSH_TRANSLATION_OMEGA_LIVE === '1' && (process.env.OMEGA_API_KEY?.length ?? 0) > 0

it.skipIf(!enabled)('translates a small independent billed query with exact Flash and thinking off', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-paid-translation-live-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = root
  let close: (() => Promise<void>) | undefined
  try {
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, JSON.stringify([
      { id: 'llm', name: '@omega-ai/dsh-llm' },
      { id: 'sessions', name: '@omega-ai/dsh-session' },
      { id: 'storage', name: '@omega-ai/dsh-session-persistence-jsonl', config: { root: join(root, 'sessions'), compression: 'none' } },
      { id: 'omega-auth', name: '@omega-ai/dsh-omega-auth' },
      { id: 'official-live-owner', name: '@omega-ai/dsh-llm-omega-api-key' },
      { id: 'translator', name: '@omega-ai/dsh-experimental-translator', config: { omegaMaxOutputTokens: 128 } },
    ]))
    const modules = new Map<string, unknown>([
      ['@omega-ai/dsh-llm', LlmRuntime], ['@omega-ai/dsh-session', SessionStore],
      ['@omega-ai/dsh-session-persistence-jsonl', JsonlPersistence],
      ['@omega-ai/dsh-omega-auth', OmegaAuth],
      ['@omega-ai/dsh-llm-omega-api-key', Official], ['@omega-ai/dsh-experimental-translator', Translator],
    ])
    const ctx = await boot('paid-translation-live', configPath, [], (host) => {
      const source: ModuleLoaderV2 = {
        version: 'v2', loadCache: new Map(),
        async import(specifier) {
          if (!modules.has(specifier)) throw new Error(`Unexpected live fixture import: ${specifier}`)
          return modules.get(specifier)
        },
        register(): never { throw new Error('Unexpected module hook registration') },
        getOrCreateModuleJob(): never { throw new Error('Unexpected module job creation') },
        resolveSync(): never { throw new Error('Unexpected synchronous module resolution') },
        load(): never { throw new Error('Unexpected module load') },
      }
      host.loader.internal = source
    })
    close = async () => { await ctx.fiber.dispose() }
    const session = ctx.sessions.create(brandString<SessionId>('paid-live-translation'), { meta: { cwd: root } })
    await using _writer = await ctx.sessionPersistence.create(session.header)
    expect(await ctx.translator.availableProviders()).toContain('omega-official')
    const result = await ctx.translator.translate(ctx.translator.resolve({ provider: 'omega-official', text: 'Hello world.',
      targetLanguage: 'zh', sourceLanguage: 'en', sessionId: session.id }))
    expect(result).toContain('世界')
    expect(session.deriveMessages()).toEqual([])
    await using reader = await ctx.sessionPersistence.open(session.id, 'read')
    const events = (await reader.read()).events
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'plugin:translator/request', ignorable: true,
      data: { provider: 'omega-official', metadata: { modelRequest: { config: {
        provider: 'omega-official', model: 'omega-flash', reasoningEffort: 'off', maxTokens: 128,
      } } } },
    })
    expect(events[1]).toMatchObject({ type: 'plugin:translator/result', ignorable: true, data: { requestSeq: 0, text: result } })
  } finally {
    await close?.()
    if (previousHome === undefined) Reflect.deleteProperty(process.env, 'DSH_HOME')
    else process.env.DSH_HOME = previousHome
    await rm(root, { recursive: true, force: true })
  }
})
