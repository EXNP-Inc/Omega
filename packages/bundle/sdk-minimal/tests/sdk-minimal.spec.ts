/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@omega-ai/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('dsh-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@omega-ai/dsh-sdk-app'],
      ['sdk-jsonrpc-server', '@omega-ai/dsh-sdk-jsonrpc-server'],
      ['omega-llm-api-extensions', '@omega-ai/dsh-omega-llm-api-extensions'],
      ['session-log-omega', '@omega-ai/dsh-session-log-omega'],
      ['plugin-package-inventory-omega', '@omega-ai/dsh-plugin-package-inventory-omega'],
      ['llm-omega', '@omega-ai/dsh-llm-omega-api-key'],
      ['sandbox', '@omega-ai/dsh-sandbox-local'],
      ['session-projection', '@omega-ai/dsh-session-projection'],
      ['sandbox-policy', '@omega-ai/dsh-sandbox-policy'],
      ['subprocess', '@omega-ai/dsh-subprocess-local'],
      ['pty', '@omega-ai/dsh-terminal'],
      ['terminal-bash', '@omega-ai/dsh-terminal-bash'],
      ['terminal-pwsh', '@omega-ai/dsh-terminal-bash'],
      ['timer', '@omega-ai/cordis-plugin-timer'],
      ['llm', '@omega-ai/dsh-llm'],
      ['session', '@omega-ai/dsh-session'],
      ['session-title', '@omega-ai/dsh-session-title'],
      ['system-prompt', '@omega-ai/dsh-system-prompt'],
      ['tools', '@omega-ai/dsh-tools'],
      ['mcp-resources', '@omega-ai/dsh-mcp-resources'],
      ['agent', '@omega-ai/dsh-agent'],
      ['llm-retry', '@omega-ai/dsh-llm-retry'],
      ['jobs', '@omega-ai/dsh-jobs-local'],
      ['agent-loop', '@omega-ai/dsh-agent-loop'],
      ['persistent-bash', '@omega-ai/dsh-tool-bash-persistent'],
      ['persistent-pwsh', '@omega-ai/dsh-tool-pwsh-persistent'],
      ['sessions', '@omega-ai/dsh-session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-omega')?.config).toEqual({
      apiKeyEnv: 'OMEGA_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.DSH_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      personaPrefix: { __jsExpr: "process.env.DSH_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
