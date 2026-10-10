/**
 * Shared wire protocol for the Omega SDK runtime: the
 * newline-delimited JSON-RPC stdio transport plus the named request, result,
 * and notification types both wire ends speak. The runtime server plugin
 * (`@omega-ai/dsh-sdk-jsonrpc-server`) serves this protocol; SDK clients
 * (`@omega-ai/dsh-sdk-client`, the Python SDK) drive it.
 *
 * @module @omega-ai/dsh-sdk-protocol
 */

export { JsonRpcLineTransport, JsonRpcResponseError } from './transport.ts'
export type { JsonRpcTransportPeer } from './transport.ts'
export type {
  HarnessSdkNotificationMap,
  HarnessSdkRequestMap,
  InitializeParams,
  InitializeResult,
  SdkEncodedImageBlock,
  SdkPromptContentBlock,
  SdkRunStatus,
  SessionEventNotification,
  SessionStatusNotification,
  SessionPromptParams,
  SessionPromptResult,
  SubagentFinishedNotification,
  SubagentStartedNotification,
} from './types.ts'
