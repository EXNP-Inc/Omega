import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@omega-ai/dsh-api-workspace-files',
  ['lib/types/index.js'],
  { hostPhase: true },
)
