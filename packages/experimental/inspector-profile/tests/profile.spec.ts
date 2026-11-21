/** The optional Developer Tools bundle enables both inspectors, including fetch capture. */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEntryYaml } from '@omega-ai/cordis-plugin-include'

describe('Inspector profile bundle', () => {
  it('publishes one layer containing both inspectors and the Statistics view', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      publishConfig: { access: string }
      dsh: { bundle: { patch: string } }
      dependencies: Record<string, string>
    }
    expect(manifest.publishConfig.access).toBe('public')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dependencies).toEqual({
      '@omega-ai/dsh-experimental-client-ui-stats': 'workspace:*',
      '@omega-ai/dsh-experimental-inspector': 'workspace:*',
      '@omega-ai/dsh-experimental-session-inspector': 'workspace:*',
    })
    expect(parseEntryYaml(readFileSync(new URL(`../${manifest.dsh.bundle.patch}`, import.meta.url), 'utf8'))).toEqual([{ insert: [
      {
        id: 'experimental-inspector', name: '@omega-ai/dsh-experimental-inspector',
        disabled: false, config: { captureFetch: true },
      },
      { id: 'session-inspector', name: '@omega-ai/dsh-experimental-session-inspector' },
      { id: 'client-ui-stats', name: '@omega-ai/dsh-experimental-client-ui-stats' },
    ] }])
  })
})
