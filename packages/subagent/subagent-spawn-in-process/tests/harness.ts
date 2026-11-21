import { mountWorkingDirectoryFixture } from '../../subagent/tests/working-directory-fixture.ts'
import { join } from 'node:path'
import * as JsonlSessionPersistence from '@omega-ai/dsh-session-persistence-jsonl'
import { Context } from '@omega-ai/cordis'
import type { Agent } from '@omega-ai/dsh-agent'
import AgentLoop from '@omega-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@omega-ai/dsh-agent-loop-testkit'
import { LocalBashExecutor } from '@omega-ai/dsh-bash-local'
import * as BashEnvPlugin from '@omega-ai/dsh-shell-env'
import LocalSubprocessRuntime from '@omega-ai/dsh-subprocess-local'
import * as ToolBash from '@omega-ai/dsh-tool-bash'
import * as LlmOmega from '@omega-ai/dsh-llm-omega-api-key'
import SubagentRuntime from '@omega-ai/dsh-subagent'
import * as Spawn from '../src/index.ts'
import OmegaAuth from '@omega-ai/dsh-omega-auth'
import * as ToolSubagent from '@omega-ai/dsh-tool-subagent'

/**
 * Shared harness for the spawn-backend e2e: the full real stack (Omega
 * adapter + real bash tool + the subagent tool bound to the spawn backend), so
 * a real parent agent can delegate to a real in-process child that does real
 * work (writes a file). Lives outside the *.e2e.ts pattern so importing it never
 * re-registers another file's tests.
 */
export async function spawnHarness(workdir: string): Promise<Context> {
  const ctx = new Context()
  // This harness installs only the global default persona, so both parent and
  // spawned children render it. It stays neutral for both roles; the
  // delegation nudge lives in the e2e's user prompt and the subagent tool's
  // own description.
  await mountAgentLoopTestDependencies(ctx, {
    workingDirectory: true,
    systemPrompt: { personaPrefix: 'You are a coding agent. Report only when the requested work is done.' },
  })
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(OmegaAuth)
  await ctx.plugin(LlmOmega)
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(BashEnvPlugin)
  await ctx.plugin(LocalBashExecutor, { cwd: workdir, timeoutMs: 30_000 })
  await ctx.plugin(ToolBash)
  await ctx.plugin(JsonlSessionPersistence, { root: join(workdir, '.sessions') })
  await mountWorkingDirectoryFixture(ctx)
  await ctx.plugin(SubagentRuntime)
  await ctx.plugin(Spawn, { providerName: 'spawn' })
  // The model-facing subagent tool, bound to the spawn backend.
  await ctx.plugin(ToolSubagent, { provider: 'spawn' })
  return ctx
}

export async function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  do {
    await agent.whenIdle()
  } while (await ctx.subagents.waitForTreeWork(agent))
}
