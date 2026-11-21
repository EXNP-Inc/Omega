/** Account sign-out policy over the latest logged request route of each running Agent. */
import type { Context } from '@omega-ai/cordis'
import { LlmError } from '@omega-ai/dsh-llm'
import type { Agent } from '@omega-ai/dsh-agent'
import type {} from '@omega-ai/dsh-omega-account'

/** Whether a running Agent's latest bound request used the account route `provider`. */
function isRunningAccountTask(agent: Pick<Agent, 'status' | 'session'>, provider: string): boolean {
  return agent.status === 'running' && agent.session.requestContext()?.provider === provider
}

/**
 * End the running Agents whose latest request used the account route `provider`, keeping their inboxes.
 * @param ctx - context whose optional Agent registry is read when this runs; without one nothing is cancelled.
 * @param provider - the account route id.
 */
export function cancelAccountTasks(ctx: Context, provider: string): void {
  for (const agent of ctx.get('agents')?.list() ?? []) {
    if (isRunningAccountTask(agent, provider)) {
      agent.cancel({ kind: 'hook', reason: 'omega-account/signed-out' }, { keepInbox: true })
    }
  }
}

/**
 * Cancel signed-out account tasks, publish sign-in guidance for rejected
 * requests, and report running account work to the account service's
 * sign-out confirmation. Each listener attaches once the service it needs is
 * mounted and detaches with this plugin; a request that outlives the plugin
 * ends its tasks through {@link cancelAccountTasks} when its credential is
 * signed out.
 * @param ctx - account route plugin lifetime; Agents and the account service may attach later.
 * @param provider - the account route id this plugin registers.
 */
export function installAccountTaskCancellation(ctx: Context, provider: string): void {
  ctx.inject(['agents'], (scope) => {
    scope.on('agent/error', ({ error }) => {
      if (error instanceof LlmError && error.code === 'ACCOUNT_SIGN_IN_REQUIRED') {
        scope.emit('omega-account/model-sign-in-required')
      }
    })
    scope.on('omega-account/signed-out', () => { cancelAccountTasks(scope, provider) })
    scope.inject(['omegaAccount'], (reporting) => {
      reporting.effect(() => reporting.omegaAccount.registerRunningTaskReport(
        () => reporting.agents.list().some(agent => isRunningAccountTask(agent, provider)),
      ), 'llm-omega-account: running task report')
    })
  })
}
