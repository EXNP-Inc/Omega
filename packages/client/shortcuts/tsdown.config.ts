import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@omega-ai/dsh-client-shortcuts',
  ['lib/types/index.js', 'lib/types/protocol.js'],
  { hostPhase: true },
)
