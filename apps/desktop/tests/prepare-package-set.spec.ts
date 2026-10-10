import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertDesktopHostPackageFiles,
  selectDesktopPackageClosure,
  type PackedDesktopPackage,
} from '../scripts/prepare-package-set.ts'

function packed(name: string, manifest: Record<string, unknown> = {}): PackedDesktopPackage {
  return { tarball: `${name}.tgz`, manifest: { name, version: '1.0.0', ...manifest } }
}

describe('desktop package-set selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not select a packaging target when imported as a library', async () => {
    vi.stubEnv('DSH_DESKTOP_TARGET_PLATFORM', 'linux')
    vi.stubEnv('DSH_DESKTOP_TARGET_ARCH', 'x64')
    vi.resetModules()
    await expect(import('../scripts/prepare-package-set.ts')).resolves.toHaveProperty('prepareDesktopPackageSet')
  })

  it('includes only the available internal production closure', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@omega-ai/dsh', packed('@omega-ai/dsh', {
        dependencies: { '@omega-ai/dsh-base': '^1.0.0', external: '^2.0.0' },
        optionalDependencies: { '@omega-ai/platform-package': '1.0.0', '@omega-ai/missing-platform': '1.0.0' },
      })],
      ['@omega-ai/dsh-desktop-host', packed('@omega-ai/dsh-desktop-host', {
        dependencies: { '@omega-ai/dsh': '^1.0.0' },
      })],
      ['@omega-ai/dsh-base', packed('@omega-ai/dsh-base', {
        peerDependencies: { '@omega-ai/cordis': '^1.0.0' },
      })],
      ['@omega-ai/cordis', packed('@omega-ai/cordis')],
      ['@omega-ai/platform-package', packed('@omega-ai/platform-package')],
      ['@omega-ai/unused', packed('@omega-ai/unused')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@omega-ai/cordis',
      '@omega-ai/dsh',
      '@omega-ai/dsh-base',
      '@omega-ai/dsh-desktop-host',
      '@omega-ai/platform-package',
    ])
  })

  it.each([
    '@omega-ai/dsh-base', '@omega-ai/cordis', '@omega-ai/node-addon-system',
  ])('rejects required prepared package %s absent from the packed release inputs', (dependency) => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@omega-ai/dsh', packed('@omega-ai/dsh', {
        dependencies: { [dependency]: '^1.0.0' },
      })],
      ['@omega-ai/dsh-desktop-host', packed('@omega-ai/dsh-desktop-host', {
        dependencies: { '@omega-ai/dsh': '^1.0.0' },
      })],
    ])
    expect(() => selectDesktopPackageClosure(available)).toThrow(/unpacked package/u)
    expect(() => selectDesktopPackageClosure(new Map([
      ['@omega-ai/dsh', packed('@omega-ai/dsh')],
    ]))).toThrow(/omit @omega-ai\/dsh-desktop-host/u)
  })

  it('leaves independently published Office packages to npm resolution', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@omega-ai/dsh', packed('@omega-ai/dsh', {
        dependencies: {
          '@deepseek-ai/libreoffice-kit': '0.0.1',
          '@deepseek-ai/libreoffice-kit-wasm': '0.0.1',
        },
      })],
      ['@omega-ai/dsh-desktop-host', packed('@omega-ai/dsh-desktop-host')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@omega-ai/dsh', '@omega-ai/dsh-desktop-host',
    ])
  })

  it('requires both Desktop Host and public CLI entries', () => {
    const files = [
      'package/lib/index.js',
      'package/lib/cli.js',
    ]
    expect(() => {
      assertDesktopHostPackageFiles(files)
    }).not.toThrow()
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(1))
    }).toThrow(/lib\/index\.js/u)
    expect(() => { assertDesktopHostPackageFiles(files.slice(0, 1)) }).toThrow(/lib\/cli\.js/u)
  })
})
