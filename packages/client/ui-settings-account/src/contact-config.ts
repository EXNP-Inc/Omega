/** Public contact and bonus notice options shared by Host and Client. */
import z from '@omega-ai/schemastery'

/** Questionnaire destination and bonus notice timings shared by Host and Client. */
export interface ContactConfig {
  /** Questionnaire URL (HTTPS, or HTTP on a host the browser can open); override for a local form. */
  contactFormUrl: string
  /** Questionnaire source option; empty until Harness is supported by the form. */
  contactSource: string
  /** First delay before retrying a failed bonus acknowledgement. */
  bonusAckRetryDelayMs: number
  /** Ceiling for the acknowledgement retry backoff. */
  bonusAckRetryMaxDelayMs: number
}
/** Validate public questionnaire options. */
export const ContactConfigFields = {
  contactFormUrl: z.string().pattern(/^https?:\/\/[^/\s]+\//).default('http://127.0.0.1:8090/contact'),
  contactSource: z.string().default(''),
  bonusAckRetryDelayMs: z.number().min(1).default(1_000),
  bonusAckRetryMaxDelayMs: z.number().min(1).default(60_000),
}
/** Validate public questionnaire options. */
export const ContactConfig: z<Partial<ContactConfig>, ContactConfig> = z.object(ContactConfigFields)
/** Bootstrap key containing no account credentials. */
export const CONTACT_CONFIG_GLOBAL = '__DSH_CONTACT_CONFIG__'
