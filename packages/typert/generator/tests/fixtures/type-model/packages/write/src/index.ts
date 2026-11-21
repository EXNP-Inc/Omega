import { Service } from '@omega-ai/cordis'

/** Service whose public annotations are intentionally absent. */
export class WritableService extends Service {
  value = 1

  echo(input = 'value') {
    return input
  }
}

declare module '@omega-ai/cordis' {
  interface Context {
    writable: WritableService
  }
}

export default WritableService
