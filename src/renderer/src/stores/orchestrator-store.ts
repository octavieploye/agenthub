import { create } from 'zustand'
import type {
  OrchestratorRunStatus,
  OrchestratorStartInput,
  OrchestratorStatusChangePayload,
  OrchestratorTaskPhaseChangePayload,
  OrchestratorTaskLog,
} from '@shared/types/orchestrator.types'

interface OrchestratorStore {
  // State
  runStatus: OrchestratorRunStatus | null
  sprintName: string | null
  runId: string | null
  singleTaskId: string | null
  completedCount: number
  totalCount: number
  failedCount: number
  taskLogs: Map<string, OrchestratorTaskLog[]>
  taskProgress: Map<string, { status: string; skill: string | null; model: string | null; startedAt: string | null }>
  loading: boolean
  error: string | null

  // Actions
  fetchStatus: () => Promise<void>
  fetchTaskLogs: (taskId: string) => Promise<void>
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
  taskLogs: new Map(),
  taskProgress: new Map(),
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

  startSingleTask: async (taskId: string, _repoId: string, _sprintName?: string | null, _projectId?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.startSingleTask({ taskId })
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
        set({ runStatus: 'cancelled', singleTaskId: null, taskProgress: new Map() })
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
    if (payload.status === 'completed' || payload.status === 'failed' || payload.status === 'cancelled') {
      set({
        runStatus: payload.status,
        sprintName: payload.sprintName,
        runId: payload.runId,
        singleTaskId: null,
        taskProgress: new Map(),
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
    if (!payload?.taskId) return
    set((state) => {
      const next = new Map(state.taskProgress)
      const existing = next.get(payload.taskId)
      next.set(payload.taskId, {
        // payload.phase maps to the displayed skill label (e.g. 'dev', 'review', 'security')
        status: payload.status,
        skill: payload.phase ?? existing?.skill ?? null,
        model: existing?.model ?? null,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
      })
      return { taskProgress: next }
    })
  },

  clearError: () => set({ error: null }),
}))
