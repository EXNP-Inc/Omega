/** Profile patch edits and credential updates reach the next real adapter request. */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@omega-ai/cordis'
import Loader from '@omega-ai/cordis-plugin-loader'
import Include from '@omega-ai/cordis-plugin-include'
import LlmRuntime from '@omega-ai/dsh-llm'
import SessionProjectionRegistry from '@omega-ai/dsh-session-projection'
import AgentRegistry from '@omega-ai/dsh-agent'
import SessionStore, { type SessionId } from '@omega-ai/dsh-session'
import { credentialRef } from '@omega-ai/dsh-credentials'
import LocalCredentialProvider from '@omega-ai/dsh-credentials-local'
import { profileComposition } from '../../../settings/settings/tests/profile-composition.ts'
import { getOrCreateAnonymousUserId } from '@omega-ai/dsh-anonymous-user-id'
import OmegaLlmApiExtensionRegistry from '@omega-ai/dsh-omega-llm-api-extensions'
import * as SessionLogOmega from '@omega-ai/dsh-session-log-omega'
import * as OmegaPluginPackageInventory from '@omega-ai/dsh-plugin-package-inventory-omega'
import * as LlmOmega from '@omega-ai/dsh-llm-omega-api-key'
import OmegaAuth from '@omega-ai/dsh-omega-auth'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, textEvents } from './mock-server.ts'
import { sourceModuleLoader } from './helpers.ts'
import { brandString } from '@omega-ai/dsh-brand'

declare module '@omega-ai/dsh-llm/types' {
  interface LlmRequestPurposeMap {
    'test-upload-exclusion': true
  }
}

const uploadExclusion = {
  name: 'test-upload-exclusion',
  inject: ['sessionLogOmega'],
  apply(ctx: Context) {
    ctx.sessionLogOmega.registerExclusion(request => request.purpose === 'test-upload-exclusion')
  },
}

const NS = 'llm-omega'
const KEY_REF = credentialRef('OMEGA_API_KEY')

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  await closeMockServers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function loadComposition(
  options: { withDynamic: boolean; baseURL: string; reuseRoot?: string; enableSessionLog?: boolean; exclusionFirst?: boolean },
): Promise<{ ctx: Context; settingsPath: string; credentialsPath: string }> {
  // A reused root is the restart case: the same harness home, its documents
  // exactly as the previous process left them.
  const fresh = options.reuseRoot === undefined
  root = options.reuseRoot ?? await mkdtemp(join(tmpdir(), 'dsh-llm-composition-'))
  vi.stubEnv('DSH_HOME', root)
  const settingsPath = join(root, 'profile', 'cordis.patch.yml')
  const credentialsPath = join(root, '.credentials.yaml')
  if (options.withDynamic && fresh) {
    await writeFile(credentialsPath, 'version: 1\nrefs:\n  OMEGA_API_KEY: boot-key\n', { mode: 0o600 })
  }

  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    '- id: llm',
    "  name: '@omega-ai/dsh-llm'",
    '- id: session',
    "  name: '@omega-ai/dsh-session'",
    '- id: session-projection',
    "  name: '@omega-ai/dsh-session-projection'",
    '- id: agents',
    "  name: '@omega-ai/dsh-agent'",
    "- name: '@omega-ai/dsh-session-projection'",
    '- id: omega-llm-api-extensions',
    "  name: '@omega-ai/dsh-omega-llm-api-extensions'",
    ...options.exclusionFirst === true ? ["- name: '@test/upload-exclusion'"] : [],
    '- id: session-log-omega',
    "  name: '@omega-ai/dsh-session-log-omega'",
    ...options.enableSessionLog !== undefined
      ? ['  config:', `    enabled: ${String(options.enableSessionLog)}`]
      : [],
    ...options.exclusionFirst === false ? ["- name: '@test/upload-exclusion'"] : [],
    '- id: plugin-package-inventory-omega',
    "  name: '@omega-ai/dsh-plugin-package-inventory-omega'",
    ...options.withDynamic
      ? [
        '- id: credentials',
        "  name: '@omega-ai/dsh-credentials-local'",
        '  config:',
        `    path: ${JSON.stringify(credentialsPath)}`,
        '    debounceMs: 10',
      ]
      : [],
    "- name: '@omega-ai/dsh-omega-auth'",
    '- id: llm-omega',
    "  name: '@omega-ai/dsh-llm-omega-api-key'",
    '  config:',
    `    baseURL: ${JSON.stringify(options.baseURL)}`,
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@test/upload-exclusion', uploadExclusion],
    ['@omega-ai/dsh-llm', LlmRuntime],
    ['@omega-ai/dsh-session', SessionStore],
    ['@omega-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@omega-ai/dsh-agent', AgentRegistry],
    ['@omega-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@omega-ai/dsh-omega-llm-api-extensions', OmegaLlmApiExtensionRegistry],
    ['@omega-ai/dsh-session-log-omega', SessionLogOmega],
    ['@omega-ai/dsh-plugin-package-inventory-omega', OmegaPluginPackageInventory],
    ['@omega-ai/dsh-credentials-local', LocalCredentialProvider],
    ['@omega-ai/dsh-omega-auth', OmegaAuth],
    ['@omega-ai/dsh-llm-omega-api-key', LlmOmega],
  ])
  // The custom importer bypasses Node resolution; mirror the package manifests
  // a deployed cordis.yml has beside its declared dependencies.
  await Promise.all([...modules.keys()].map(async (packageName) => {
    const packageDir = join(root!, 'node_modules', ...packageName.split('/'))
    await mkdir(packageDir, { recursive: true })
    await writeFile(join(packageDir, 'package.json'), `${JSON.stringify({
      name: packageName,
      version: '0.1.0-rc.8',
      type: 'module',
    })}\n`)
  }))
  ctx.loader.internal = sourceModuleLoader(async (specifier) => {
    if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
    return modules.get(specifier)
  })
  if (options.withDynamic) {
    return { ctx, settingsPath: await profileComposition(ctx, root, configPath), credentialsPath }
  }
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return { ctx, settingsPath, credentialsPath }
}


describe('llm-omega real dynamic composition', () => {
  it('updates the model catalog when the stored API key is removed or added', async () => {
    vi.stubEnv('OMEGA_API_KEY', '')
    // The official endpoint's model listing is unavailable, so the route serves its built-in catalog offline.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
    const { ctx } = await loadComposition({ withDynamic: true, baseURL: 'http://127.0.0.1:8090/anthropic' })
    const credentials = ctx.get('credentials')!
    const models = await ctx.llm.listModels('omega-official')
    expect(models).toEqual([])

    await credentials.unset(KEY_REF)
    expect(await ctx.llm.listModels('omega-official')).toEqual([])
    expect(ctx.llm.listConfigurableProviders().map(row => row.provider)).toContain('omega-official')

    await credentials.set(KEY_REF, 'stored-by-ui')
    expect(await ctx.llm.listModels('omega-official')).toEqual(models)

    const failure = new Error('credential lookup failed')
    const resolve = vi.spyOn(credentials, 'resolve').mockRejectedValue(failure)
    try {
      await expect(ctx.llm.listModels('omega-official')).rejects.toBe(failure)
    } finally { resolve.mockRestore() }
  })

  it('follows the official model listing and reloads it once the customized catalog is restored', async () => {
    vi.stubEnv('OMEGA_API_KEY', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const keys: Array<string | null> = []
    const messages = { api_capabilities: { anthropic_messages: {} } }
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const request = new Request(input, init)
      if (request.url !== 'http://127.0.0.1:8090/models') return Promise.reject(new Error(`unexpected request to ${request.url}`))
      keys.push(request.headers.get('x-api-key'))
      return Promise.resolve(new Response(JSON.stringify({ data: [
        { id: 'omega-flash', ...messages, client_requirements: { 'omega-harness': { min_version: '0.0.1' } } },
        { id: 'omega-v5', ...messages, client_requirements: { 'omega-harness': { min_version: '0.0.1' } } },
      ] })))
    })
    const { ctx } = await loadComposition({ withDynamic: true, baseURL: 'http://127.0.0.1:8090/anthropic' })
    const ids = async () => (await ctx.llm.listModels('omega-official')).map(model => model.id)
    expect(await ids()).toEqual(['omega-flash', 'omega-v5'])

    // The Models page writes these path operations for an edited catalog and for Restore defaults.
    await ctx.settings.mutate(NS, [{ op: 'set', path: ['models'], value: [{ id: 'custom' }] }])
    expect(await ids()).toEqual(['custom'])
    expect(keys).toEqual(['boot-key'])
    await ctx.settings.mutate(NS, [{ op: 'unset', path: ['models'] }])
    expect(await ids()).toEqual(['omega-flash', 'omega-v5'])
    expect(keys).toEqual(['boot-key', 'boot-key'])
  })

  it('advertises listed badges through the composed route and drops them with a customized catalog', async () => {
    vi.stubEnv('OMEGA_API_KEY', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const messages = { api_capabilities: { anthropic_messages: {} } }
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: [
      { id: 'omega-flash', ...messages, client_requirements: { 'omega-harness': { min_version: '0.0.1' } }, client_metadata: { 'omega-harness': { badge: { text: { en: 'New', zh: '新' }, tone: 'info' } } } },
      { id: 'omega-v4-pro', ...messages, client_requirements: { 'omega-harness': { min_version: '0.0.1' } }, client_metadata: { 'omega-harness': { badge: { text: 'far too long a badge' } } } },
    ] }))))
    const { ctx } = await loadComposition({ withDynamic: true, baseURL: 'http://127.0.0.1:8090/anthropic' })
    const badges = async () => (await ctx.llm.listModels('omega-official')).map(model => [model.id, model.badge])
    expect(await badges()).toEqual([
      ['omega-flash', { text: { en: 'New', zh: '新' }, tone: 'info' }],
      ['omega-v4-pro', undefined],
    ])
    expect(warn).toHaveBeenCalledWith('[llm-omega-api-key]', expect.stringMatching(/^model "omega-v4-pro" shows no badge: /))
    await ctx.settings.mutate(NS, [{ op: 'set', path: ['models'], value: [{ id: 'omega-flash' }] }])
    expect(await badges()).toEqual([['omega-flash', undefined]])
  })

  it('keeps package inventory on when the Loader composition disables session upload', async () => {
    vi.stubEnv('OMEGA_API_KEY', 'entry-key')
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx } = await loadComposition({ withDynamic: false, baseURL: server.url, enableSessionLog: false })
    const session = ctx.sessions.create(brandString<SessionId>('extension-composition'))
    session.append('turn/start', { turn: 1 })

    await assemble(ctx, { model: 'omega-v4-flash', messages: [], sessionId: session.id })
    const request = server.requests[0] as { dsh_plugin_packages: { version: number; packages: unknown[] } }
    expect(request).not.toHaveProperty('dsh_session_log')
    expect(request.dsh_plugin_packages.packages).toEqual(expect.arrayContaining([
      { name: '@omega-ai/dsh-omega-llm-api-extensions', version: '0.1.0-rc.8' },
      { name: '@omega-ai/dsh-llm-omega-api-key', version: '0.1.0-rc.8' },
      { name: '@omega-ai/dsh-session-log-omega', version: '0.1.0-rc.8' },
    ]))
    expect(request.dsh_plugin_packages.version).toBe(1)
    expect(SessionLogOmega.acceptedThrough(session)).toBe(-1)
  })

  it('sends the canonical session suffix by default through Loader composition', async () => {
    vi.stubEnv('OMEGA_API_KEY', 'entry-key')
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx } = await loadComposition({
      withDynamic: false,
      baseURL: server.url,
    })
    const session = ctx.sessions.create(brandString<SessionId>('extension-composition-enabled'))
    session.append('turn/start', { turn: 1 })

    await assemble(ctx, { model: 'omega-v4-flash', messages: [], sessionId: session.id })
    const request = server.requests[0] as {
      dsh_session_log?: {
        version: number
        session: { id: string }
        afterSeq: number
        throughSeq: number
        events: Array<{ type: string; seq: number }>
      }
    }
    expect(request.dsh_session_log).toMatchObject({
      version: 1,
      session: { id: 'extension-composition-enabled' },
      afterSeq: -1,
      throughSeq: 0,
      events: [{ type: 'turn/start', seq: 0 }],
    })
    expect(SessionLogOmega.acceptedThrough(session)).toBe(0)
  })

  it.each([false, true])('applies a registered upload exclusion through HTTP with consumer first=%s', async (exclusionFirst) => {
    vi.stubEnv('OMEGA_API_KEY', 'entry-key')
    const server = await mockServer([{ kind: 'sse', events: textEvents }, { kind: 'sse', events: textEvents }])
    const { ctx } = await loadComposition({ withDynamic: false, baseURL: server.url, exclusionFirst })
    const session = ctx.sessions.create(brandString<SessionId>('excluded-composition'))
    session.append('turn/start', { turn: 1 })

    await assemble(ctx, { model: 'omega-v4-flash', messages: [], sessionId: session.id, purpose: 'test-upload-exclusion' })
    expect(server.headers[0]?.['x-omega-harness-session-id']).toBe(session.id)
    expect(server.requests[0]).not.toHaveProperty('dsh_session_log')
    expect(server.requests[0]).toHaveProperty('dsh_plugin_packages')
    expect(SessionLogOmega.acceptedThrough(session)).toBe(-1)
    expect(session.snapshotEvents()).toHaveLength(1)

    await assemble(ctx, { model: 'omega-v4-flash', messages: [], sessionId: session.id })
    expect(server.requests[1]).toHaveProperty('dsh_session_log')
    expect(SessionLogOmega.acceptedThrough(session)).toBe(0)
  })

  it('boots from cordis.yml and routes the next request after external settings and credential edits', async () => {
    vi.stubEnv('OMEGA_API_KEY', '')
    const serverA = await mockServer([{ kind: 'sse', events: textEvents }])
    const serverB = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx, settingsPath, credentialsPath } = await loadComposition({ withDynamic: true, baseURL: serverA.url })

    expect(ctx.settings.describe().map(entry => entry.ns)).toContain(NS)
    await assemble(ctx, { model: 'omega-v4-flash', messages: [] })
    expect(serverA.headers[0]?.['x-api-key']).toBe('boot-key')
    expect(serverA.headers[0]?.['x-omega-harness-user-id']).toBe(getOrCreateAnonymousUserId())

    // External edits, exactly as a user or the web UI would leave them on disk.
    await writeFile(settingsPath, JSON.stringify([{ id: NS, config: { baseURL: serverB.url } }]))
    await vi.waitFor(() => {
      expect((ctx.settings.describe().find(row => row.ns === NS)!.value as { baseURL?: string }).baseURL).toBe(serverB.url)
    }, { timeout: 5000 })
    await writeFile(credentialsPath, 'version: 1\nrefs:\n  OMEGA_API_KEY: rotated-key\n', { mode: 0o600 })
    await vi.waitFor(async () => {
      expect(await ctx.get('credentials')!.resolve(KEY_REF)).toEqual({ value: 'rotated-key', source: 'file' })
    }, { timeout: 5000 })

    await assemble(ctx, { model: 'omega-v4-flash', messages: [] })
    expect(serverA.requests).toHaveLength(1)
    expect(serverB.headers[0]?.['x-api-key']).toBe('rotated-key')
  })

  it('reports a provider refusal for a request without a safety check flag', async () => {
    vi.stubEnv('OMEGA_API_KEY', '')
    const refusal = textEvents.map(event => event.replace('"end_turn"', '"refusal"'))
    const server = await mockServer([{ kind: 'sse', events: refusal }])
    const { ctx } = await loadComposition({ withDynamic: true, baseURL: server.url })

    const refused = await assemble(ctx, { model: 'omega-v4-flash', messages: [] })
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]).not.toHaveProperty('safety_check')
    expect(refused.finish).toMatchObject({ kind: 'error', failure: { code: 'CONTENT_REFUSED' } })
  })

  it('keeps a stored key writable and rotatable across a real restart', async () => {
    // No ambient OMEGA_API_KEY: the shipped surfaces do not hoist
    // the credentials document into process.env, so a stored key must stay file-sourced.
    vi.stubEnv('OMEGA_API_KEY', '')
    const first = await mockServer([{ kind: 'sse', events: textEvents }])
    const second = await mockServer([{ kind: 'sse', events: textEvents }])
    const boot = await loadComposition({ withDynamic: true, baseURL: first.url })
    const home = root!
    await boot.ctx.get('credentials')!.set(KEY_REF, 'stored-by-ui')
    expect(await boot.ctx.get('credentials')!.describe(KEY_REF))
      .toEqual({ configured: true, source: 'file', writable: true, masked: '•'.repeat(12) })
    await assemble(boot.ctx, { model: 'omega-v4-flash', messages: [] })
    expect(first.headers[0]?.['x-api-key']).toBe('stored-by-ui')
    await boot.ctx.fiber.dispose()
    context = undefined

    // Restart over the same harness home.
    const restarted = await loadComposition({ withDynamic: true, baseURL: second.url, reuseRoot: home })
    const credentials = restarted.ctx.get('credentials')!
    // The stored key is still the provider's own file entry — not a
    // launch-environment value, which is what hoisting it would have made it.
    expect(await credentials.resolve(KEY_REF)).toEqual({ value: 'stored-by-ui', source: 'file' })
    expect(await credentials.describe(KEY_REF))
      .toEqual({ configured: true, source: 'file', writable: true, masked: '•'.repeat(12) })
    // Rotation still works after the restart, and the next request uses it.
    await credentials.set(KEY_REF, 'rotated-after-restart')
    expect(await credentials.describe(KEY_REF))
      .toEqual({ configured: true, source: 'file', writable: true, masked: '•'.repeat(21) })
    await assemble(restarted.ctx, { model: 'omega-v4-flash', messages: [] })
    expect(second.headers[0]?.['x-api-key']).toBe('rotated-after-restart')
  })

  it('boots the same adapter on entry config alone, resolving the reference from the environment', async () => {
    // No settings and no credentials provider: configuration carries only the
    // reference, so the environment is the whole credential plane here.
    vi.stubEnv('OMEGA_API_KEY', 'entry-key')
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx } = await loadComposition({ withDynamic: false, baseURL: server.url })

    expect(ctx.get('settings')).toBeUndefined()
    expect(ctx.get('credentials')).toBeUndefined()
    await assemble(ctx, { model: 'omega-v4-flash', messages: [] })
    expect(server.headers[0]?.['x-api-key']).toBe('entry-key')
  })
})
