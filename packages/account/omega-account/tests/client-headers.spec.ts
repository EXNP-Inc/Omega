/** Platform client identity headers derived from one call's metadata. */
import { expect, it } from 'vitest'
import { platformClientHeaders } from '../src/client-metadata.ts'

it.each([
  ['darwin', 'desktop-mac'], ['win32', 'desktop-win'], [null, 'web'],
] as const)('maps %s to %s and leaves the bundle ID empty', (platform, expected) => {
  expect(platformClientHeaders(platform, { version: '1.2.3', locale: 'zh-CN', timezoneOffsetSeconds: 28_800 })).toEqual({
    'x-client-bundle-id': '', 'x-client-platform': expected, 'x-client-version': '1.2.3',
    'x-client-locale': 'zh_CN', 'x-client-timezone-offset': '28800',
  })
})

it('selects zh_CN only for a Chinese primary language subtag', () => {
  const locale = (value: string): string | undefined =>
    platformClientHeaders(null, { version: 'v', locale: value, timezoneOffsetSeconds: 0 })['x-client-locale']
  expect(locale('zh')).toBe('zh_CN')
  expect(locale('ZH_hans')).toBe('zh_CN')
  for (const value of ['ja', 'ja-JP', 'en', 'en-US', 'fr-FR', 'English', '', 'zhx']) expect(locale(value)).toBe('en_US')
})

it('omits the version header when the build carries no version', () => {
  const headers = platformClientHeaders(null, { locale: 'en-US', timezoneOffsetSeconds: 0 })
  expect(headers['x-client-version']).toBeUndefined()
  expect(headers).toEqual({
    'x-client-bundle-id': '', 'x-client-platform': 'web',
    'x-client-locale': 'en_US', 'x-client-timezone-offset': '0',
  })
})
