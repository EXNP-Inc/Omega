/**
 * TypeScript client SDK for the Omega runtime: spawn the
 * same-version `dsh --profile sdk` runtime as a subprocess and drive agent
 * turns over stdio JSON-RPC. `OmegaHarness` is the high-level run API;
 * `HarnessClient` is the lower-level protocol client. A pure library — it
 * registers nothing on a Cordis context; named profiles and ordered patch
 * files customize the runtime process it spawns.
 *
 * @module @omega-ai/dsh-sdk-client
 */

export { OmegaHarness, HarnessSession } from './api.ts'
export type { RunOptions } from './api.ts'
export {
  HarnessClient,
  RequestTimeoutError,
  SdkProtocolError,
  TransportClosedError,
} from './client.ts'
export type { NotificationSubscription } from './client.ts'
export { JsonRpcResponseError } from '@omega-ai/dsh-sdk-protocol'
export type {
  ContentBlock,
  SdkPromptContentBlock,
  OmegaHarnessOptions,
  HarnessClientOptions,
  HarnessNotification,
  NotificationFilter,
  RunResult,
} from './types.ts'
