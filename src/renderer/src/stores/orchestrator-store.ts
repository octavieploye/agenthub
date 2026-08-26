import { create } from 'zustand'
import type {
  OrchestratorRunStatus,
  OrchestratorStartInput,
  OrchestratorStatusChangePayload,
  OrchestratorTaskPhaseChangePayload,
  OrchestratorTaskLog,
  OrchestratorPhase,
  OrchestratorPhaseStatus,
  RetryFailure,
} from '@shared/types/orchestrator.types'

interface PhaseState {
  phase: OrchestratorPhase
  status: OrchestratorPhaseStatus
}

interface OrchestratorStore {
  // State
  runStatus: OrchestratorRunStatus | null
  sprintName: string | null
  runId: string | null
  singleTaskId: string | null
  completedCount: number
  totalCount: number
  failedCount: number
  taskPhases: Map<string, PhaseState>
  taskLogs: Map<string, OrchestratorTaskLog[]>
  retryFailures: RetryFailure[]
  loading: boolean
  error: string | null

  // Actions
  fetchStatus: () => Promise<void>
  fetchTaskLogs: (taskId: string) => Promise<void>
  fetchRetryFailures: () => Promise<void>
  acknowledgeRetryFailures: () => Promise<void>
  start: (input: OrchestratorStartInput) => Promise<boolean>
  startSingleTask: (taskId: string, repoId: string, sprintName?: string | null, projectId?: string) => Promise<boolean>
  cancel: () => Promise<void>
  pause: () => Promise<boolean>
  resume: () => Promise<boolean>
  handleStatusChange: (payload: OrchestratorStatusChangePayload) => void
  handleTaskPhaseChange: (payload: OrchestratorTaskPhaseChangePayload) => void
  clearError: () => void
}

export const useOrchestratorStore = create<OrchestratorStore>((set, get) => ({
  runStatus: null,
  sprintName: null,
  runId: null,
  singleTaskId: null,
  completedCount: 0,
  totalCount: 0,
  failedCount: 0,
  taskPhases: new Map(),
  taskLogs: new Map(),
  retryFailures: [],
  loading: false,
  error: null,

  fetchTaskLogs: async (taskId: string) => {
    if (get().taskLogs.has(taskId)) return
    try {
      const res = await window.agentHub.orchestrator.taskLog({ taskId })
      if (res.success) {
        set((state) => {
          const next = new Map(state.taskLogs)
          next.set(taskId, res.data)
          return { taskLogs: next }
        })
      }
    } catch {
      // silent — phase history is non-critical
    }
  },

  fetchRetryFailures: async () => {
    try {
      const res = await window.agentHub.orchestrator.getRetryFailures()
      if (res.success) {
        set({ retryFailures: res.data })
      }
    } catch {
      // silent — retry failures are non-critical
    }
  },

  acknowledgeRetryFailures: async () => {
    try {
      const res = await window.agentHub.orchestrator.acknowledgeRetryFailures()
      if (res.success) {
        set({ retryFailures: [] })
      }
    } catch {
      // silent
    }
  },

  fetchStatus: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.status()
      if (res.success) {
        const { run, completedCount, totalCount, failedCount } = res.data
        set({
          runStatus: run?.status ?? null,
          sprintName: run?.sprintName ?? null,
          runId: run?.id ?? null,
          singleTaskId: run?.singleTaskId ?? null,
          completedCount,
          totalCount,
          failedCount,
          loading: false,
        })
      } else {
        set({ error: res.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  start: async (input: OrchestratorStartInput) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.start(input)
      if (res.success) {
        set({
          runId: res.data.id,
          runStatus: res.data.status,
          sprintName: res.data.sprintName,
          loading: false,
        })
        return true
      } else {
        set({ error: res.error.message, loading: false })
        return false
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return false
    }
  },

  pause: async () => {
    const { runId } = get()
    if (!runId) return false
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.pause({ runId })
      if (res.success) {
        set({ runStatus: 'paused', loading: false })
        return true
      } else {
        set({ error: res.error.message, loading: false })
        return false
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return false
    }
  },

  resume: async () => {
    const { runId } = get()
    if (!runId) return false
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.resume({ runId })
      if (res.success) {
        set({ runStatus: 'running', loading: false })
        return true
      } else {
        set({ error: res.error.message, loading: false })
        return false
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return false
    }
  },

  startSingleTask: async (taskId: string, repoId: string, sprintName?: string | null, projectId?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.start({
        sprintName: sprintName || `pipeline-${taskId.slice(0, 8)}`,
        repoId,
        projectId,
        singleTaskId: taskId,
        concurrencyCap: 1,
        confirmed: true,
        triggerSource: 'single-task',
      })
      if (res.success) {
        set({
          runId: res.data.id,
          runStatus: res.data.status,
          sprintName: res.data.sprintName,
          singleTaskId: res.data.singleTaskId ?? taskId,
          completedCount: 0,
          totalCount: 1,
          failedCount: 0,
          loading: false,
        })
        return true
      } else {
        set({ error: res.error.message, loading: false })
        return false
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  cancel: async () => {
    const runId = get().runId
    if (!runId) return
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.cancel({ runId })
      if (res.success) {
        set({ runStatus: 'failed', singleTaskId: null })
      } else {
        set({ error: res.error.message })
      }
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  handleStatusChange: (payload: OrchestratorStatusChangePayload) => {
    if (payload.status === 'completed' || payload.status === 'failed') {
      set({
        runStatus: payload.status,
        sprintName: payload.sprintName,
        runId: payload.runId,
        singleTaskId: null,
      })
    } else {
      set({
        runStatus: payload.status,
        sprintName: payload.sprintName,
        runId: payload.runId,
      })
    }
  },

  handleTaskPhaseChange: (payload: OrchestratorTaskPhaseChangePayload) => {
    set((state) => {
      const phases = new Map(state.taskPhases)
      phases.set(payload.taskId, { phase: payload.phase, status: payload.status })
      const logs = new Map(state.taskLogs)
      logs.delete(payload.taskId)
      return { taskPhases: phases, taskLogs: logs }
    })
  },

  clearError: () => set({ error: null }),
}))
