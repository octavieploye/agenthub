import log from 'electron-log/main'
import type { Database } from 'better-sqlite3'
import type { AgentSpawnOptions, AgentState } from '../../shared/types/agent.types'
import type { OrchestratorTaskLog, OrchestratorPhase } from '../../shared/types/orchestrator.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskLogInput {
  runId: string
  taskId: string
  phase: OrchestratorPhase
  modelUsed?: string
  providerUsed?: string
}

export interface DispatchDeps {
  spawnAgent: (options: AgentSpawnOptions) => AgentState
  insertTaskLog: (db: Database, input: TaskLogInput) => OrchestratorTaskLog
  emitToRenderer: (channel: string, ...args: unknown[]) => void
  db: Database
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export class OrchestratorDispatch {
  constructor(private deps: DispatchDeps) {}

  /**
   * Execute a task by spawning an agent and logging the attempt.
   * Returns agentId on success (spawn succeeded), null on failure.
   */
  async execute(
    spawnOptions: AgentSpawnOptions,
    taskId: string,
    runId: string
  ): Promise<string | null> {
    let agentState: AgentState | null = null

    // Step 1: Spawn the agent
    try {
      agentState = this.deps.spawnAgent(spawnOptions)
      log.info('[orchestrator-dispatch] agent spawned', {
        agentId: agentState.id,
        taskId,
        runId,
        model: spawnOptions.model
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      log.error('[orchestrator-dispatch] spawn failed', {
        taskId,
        runId,
        error: errMsg
      })
      return null
    }

    const agentId = agentState.id

    // Step 2: Log the task attempt
    try {
      this.deps.insertTaskLog(this.deps.db, {
        runId,
        taskId,
        phase: 'dev',
        modelUsed: spawnOptions.model,
        providerUsed: spawnOptions.provider
      })
      log.info('[orchestrator-dispatch] task log inserted', { taskId, agentId, runId })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      log.error('[orchestrator-dispatch] task log insert failed', {
        taskId,
        agentId,
        error: errMsg
      })
      // Continue — spawn succeeded even if logging failed
    }

    // Step 3: Emit phase change event to renderer
    try {
      this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE, {
        runId,
        taskId,
        agentId,
        phase: 'dev',
        status: 'active'
      })
      log.info('[orchestrator-dispatch] phase change emitted', { taskId, agentId })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      log.error('[orchestrator-dispatch] phase change emit failed', {
        taskId,
        agentId,
        error: errMsg
      })
      // Continue — spawn succeeded even if emit failed
    }

    return agentId
  }
}
