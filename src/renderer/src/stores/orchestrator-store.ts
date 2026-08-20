import { create } from 'zustand'
import type {
  OrchestratorRunStatus,
  OrchestratorStartInput,
  OrchestratorStatusChangePayload,
  OrchestratorTaskPhaseChangePayload,
  OrchestratorPhase,
  OrchestratorPhaseStatus,
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
  completedCount: number
  totalCount: number
  failedCount: number
  taskPhases: Map<string, PhaseState>
  loading: boolean
  error: string | null

  // Actions
  fetchStatus: () => Promise<void>
  start: (input: OrchestratorStartInput) => Promise<boolean>
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
  completedCount: 0,
  totalCount: 0,
  failedCount: 0,
  taskPhases: new Map(),
  loading: false,
  error: null,

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

  handleStatusChange: (payload: OrchestratorStatusChangePayload) => {
    set({
      runStatus: payload.status,
      sprintName: payload.sprintName,
      runId: payload.runId,
    })
  },

  handleTaskPhaseChange: (payload: OrchestratorTaskPhaseChangePayload) => {
    set((state) => {
      const next = new Map(state.taskPhases)
      next.set(payload.taskId, { phase: payload.phase, status: payload.status })
      return { taskPhases: next }
    })
  },

  clearError: () => set({ error: null }),
}))
