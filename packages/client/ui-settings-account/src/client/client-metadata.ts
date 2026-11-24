/**
 * Platform client identity for one account call. The Host turns these fields
 * into the Platform request headers, so the browser sends the UI language and
 * the local UTC offset rather than any credential.
 * @module @omega-ai/dsh-client-ui-settings-account/src/client/client-metadata
 */
import type { AccountClientMetadata } from '@omega-ai/dsh-omega-account/types'

/**
 * Build the request identity for one account call.
 * @param locale - active UI language; the Host reduces it to the Platform wire locale.
 * @param version - client build version inlined by the bundle; omitted when the build carries none.
 * @returns the metadata the account Remote methods carry; the version is absent when the build is version-less.
 */
export function accountClientMetadata(locale: string, version: string | undefined): AccountClientMetadata {
  return {
    ...(version === undefined || version === '' ? {} : { version }),
    locale,
    // Date.getTimezoneOffset reports minutes west of UTC; Platform wants seconds east.
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
}
