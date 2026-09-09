import { describe, it, expect, vi } from 'vitest'
import type Database from 'better-sqlite3'
import type { AgentSpawnOptions, AgentState, ModelProvider } from '../../shared/types/agent.types'
import type { OrchestratorTaskLog } from '../../shared/types/orchestrator.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import { OrchestratorDispatch, type DispatchDeps, type TaskLogInput } from './orchestrator-dispatch'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockAgentState(overrides?: Partial<AgentState>): AgentState {
  return {
    id: 'agent-test-001',
    repoId: 'repo-001',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-3.5-sonnet',
    provider: 'anthropic' as ModelProvider,
    effortLevel: 'medium',
    taskDescription: 'Test task',
    pid: null,
    ptyFd: null,
    cwd: '/test/cwd',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: 0,
    color: '#3B82F6',
    executionMode: 'native',
    voiceMode: 'off',
    telegramNotify: false,
    claudeMdHash: null,
    sessionId: 'session-001',
    ...overrides
  }
}

function createMockSpawnOptions(overrides?: Partial<AgentSpawnOptions>): AgentSpawnOptions {
  return {
    repoId: 'repo-001',
    name: 'test-agent',
    cwd: '/test/cwd',
    model: 'claude-3.5-sonnet',
    provider: 'anthropic' as ModelProvider,
    effortLevel: 'medium',
    taskDescription: 'Test task',
    ...overrides
  }
}

function createMockTaskLog(overrides?: Partial<OrchestratorTaskLog>): OrchestratorTaskLog {
  return {
    id: 'log-001',
    runId: 'run-001',
    taskId: 'task-001',
    phase: 'dev',
    status: 'pending',
    agentId: 'agent-001',
    modelUsed: 'claude-3.5-sonnet',
    providerUsed: 'anthropic',
    summaryJson: null,
    issuesJson: null,
    filesChangedJson: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrchestratorDispatch', () => {
  it('calls spawnAgent with correct options', async () => {
    const spawnAgent = vi.fn().mockReturnValue(createMockAgentState())
    const insertTaskLog = vi.fn().mockReturnValue(createMockTaskLog())
    const emitToRenderer = vi.fn()
    const db = {} as Database.Database

    const dispatch = new OrchestratorDispatch({
      spawnAgent,
      insertTaskLog,
      emitToRenderer,
      db
    })

    const spawnOptions = createMockSpawnOptions()
    const taskId = 'task-001'
    const runId = 'run-001'

    await dispatch.execute(spawnOptions, taskId, runId)

    expect(spawnAgent).toHaveBeenCalledWith(spawnOptions)
    expect(spawnAgent).toHaveBeenCalledTimes(1)
  })

  it('updates task log after spawn', async () => {
    const agentState = createMockAgentState()
    const spawnAgent = vi.fn().mockReturnValue(agentState)
    const insertTaskLog = vi.fn().mockReturnValue(createMockTaskLog())
    const emitToRenderer = vi.fn()
    const db = {} as Database.Database

    const dispatch = new OrchestratorDispatch({
      spawnAgent,
      insertTaskLog,
      emitToRenderer,
      db
    })

    const spawnOptions = createMockSpawnOptions()
    const taskId = 'task-001'
    const runId = 'run-001'

    await dispatch.execute(spawnOptions, taskId, runId)

    expect(insertTaskLog).toHaveBeenCalledWith(db, {
      runId,
      taskId,
      phase: 'dev',
      modelUsed: spawnOptions.model,
      providerUsed: spawnOptions.provider
    })
    expect(insertTaskLog).toHaveBeenCalledTimes(1)
  })

  it('emits TASK_PHASE_CHANGE IPC event', async () => {
    const agentState = createMockAgentState()
    const spawnAgent = vi.fn().mockReturnValue(agentState)
    const insertTaskLog = vi.fn().mockReturnValue(createMockTaskLog())
    const emitToRenderer = vi.fn()
    const db = {} as Database.Database

    const dispatch = new OrchestratorDispatch({
      spawnAgent,
      insertTaskLog,
      emitToRenderer,
      db
    })

    const spawnOptions = createMockSpawnOptions()
    const taskId = 'task-001'
    const runId = 'run-001'

    await dispatch.execute(spawnOptions, taskId, runId)

    expect(emitToRenderer).toHaveBeenCalledWith(
      IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE,
      expect.objectContaining({
        runId,
        taskId,
        agentId: agentState.id,
        phase: 'dev',
        status: 'active'
      })
    )
    expect(emitToRenderer).toHaveBeenCalledTimes(1)
  })

  it('returns agentId on success', async () => {
    const agentState = createMockAgentState()
    const spawnAgent = vi.fn().mockReturnValue(agentState)
    const insertTaskLog = vi.fn().mockReturnValue(createMockTaskLog())
    const emitToRenderer = vi.fn()
    const db = {} as Database.Database

    const dispatch = new OrchestratorDispatch({
      spawnAgent,
      insertTaskLog,
      emitToRenderer,
      db
    })

    const spawnOptions = createMockSpawnOptions()
    const result = await dispatch.execute(spawnOptions, 'task-001', 'run-001')

    expect(result).toBe(agentState.id)
  })

  it('returns null when spawnAgent throws', async () => {
    const spawnAgent = vi.fn().mockImplementation(() => {
      throw new Error('spawn failed')
    })
    const insertTaskLog = vi.fn()
    const emitToRenderer = vi.fn()
    const db = {} as Database.Database

    const dispatch = new OrchestratorDispatch({
      spawnAgent,
      insertTaskLog,
      emitToRenderer,
      db
    })

    const spawnOptions = createMockSpawnOptions()
    const result = await dispatch.execute(spawnOptions, 'task-001', 'run-001')

    expect(result).toBeNull()
    expect(insertTaskLog).not.toHaveBeenCalled()
    expect(emitToRenderer).not.toHaveBeenCalled()
  })

  it('continues with agentId when insertTaskLog throws', async () => {
    const agentState = createMockAgentState()
    const spawnAgent = vi.fn().mockReturnValue(agentState)
    const insertTaskLog = vi.fn().mockImplementation(() => {
      throw new Error('log insert failed')
    })
    const emitToRenderer = vi.fn()
    const db = {} as Database.Database

    const dispatch = new OrchestratorDispatch({
      spawnAgent,
      insertTaskLog,
      emitToRenderer,
      db
    })

    const spawnOptions = createMockSpawnOptions()
    const result = await dispatch.execute(spawnOptions, 'task-001', 'run-001')

    expect(result).toBe(agentState.id)
    expect(emitToRenderer).toHaveBeenCalled()
  })

  it('continues with agentId when emitToRenderer throws', async () => {
    const agentState = createMockAgentState()
    const spawnAgent = vi.fn().mockReturnValue(agentState)
    const insertTaskLog = vi.fn().mockReturnValue(createMockTaskLog())
    const emitToRenderer = vi.fn().mockImplementation(() => {
      throw new Error('emit failed')
    })
    const db = {} as Database.Database

    const dispatch = new OrchestratorDispatch({
      spawnAgent,
      insertTaskLog,
      emitToRenderer,
      db
    })

    const spawnOptions = createMockSpawnOptions()
    const result = await dispatch.execute(spawnOptions, 'task-001', 'run-001')

    expect(result).toBe(agentState.id)
  })
})
