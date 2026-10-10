import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@omega-ai/dsh-api-workspace-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
