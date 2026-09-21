import { create } from 'zustand'
import type {
  OrchestratorPhase,
  OrchestratorRun,
  OrchestratorRunStatus,
  OrchestratorStartInput,
  OrchestratorStatusChangePayload,
  OrchestratorTaskPhaseChangePayload,
  OrchestratorTaskLog,
  RetryFailure,
} from '@shared/types/orchestrator.types'

interface PendingApproval {
  runId: string
  taskId: string
  title: string
  description: string
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
  activeRuns: OrchestratorRun[]
  queuedRuns: OrchestratorRun[]
  taskLogs: Map<string, OrchestratorTaskLog[]>
  taskProgress: Map<string, { status: string; phase: OrchestratorPhase | null; skill: string | null; model: string | null; startedAt: string | null }>
  retryFailures: RetryFailure[]
  pendingApproval: PendingApproval | null
  loading: boolean
  fetchingStatus: boolean
  error: string | null

  // Actions
  fetchStatus: () => Promise<void>
  fetchTaskLogs: (taskId: string) => Promise<void>
  fetchRetryFailures: () => Promise<void>
  acknowledgeRetryFailures: () => Promise<void>
  start: (input: OrchestratorStartInput) => Promise<boolean>
  startSingleTask: (taskId: string, repoId?: string, sprintName?: string | null, projectId?: string) => Promise<boolean>
  cancel: (explicitRunId?: string) => Promise<void>
  pause: (runId?: string) => Promise<boolean>
  resume: (runId?: string) => Promise<boolean>
  handleStatusChange: (payload: OrchestratorStatusChangePayload) => void
  handleTaskPhaseChange: (payload: OrchestratorTaskPhaseChangePayload) => void
  handleApprovalNeeded: (payload: { runId: string; taskId: string; title: string; description: string }) => void
  approveTask: () => Promise<void>
  denyTask: () => Promise<void>
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
  activeRuns: [],
  queuedRuns: [],
  taskLogs: new Map(),
  taskProgress: new Map(),
  retryFailures: [],
  pendingApproval: null,
  loading: false,
  fetchingStatus: false,
  error: null,

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

  handleApprovalNeeded: (payload: { runId: string; taskId: string; title: string; description: string }) => {
    set({ pendingApproval: { runId: payload.runId, taskId: payload.taskId, title: payload.title, description: payload.description } })
  },

  approveTask: async () => {
    const { pendingApproval } = get()
    if (!pendingApproval) return
    set({ pendingApproval: null })
    try {
      await window.agentHub.orchestrator.approveTask({ runId: pendingApproval.runId, taskId: pendingApproval.taskId, approved: true })
    } catch {
      // silent — backend will surface the error via status change
    }
  },

  denyTask: async () => {
    const { pendingApproval } = get()
    if (!pendingApproval) return
    set({ pendingApproval: null })
    try {
      await window.agentHub.orchestrator.approveTask({ runId: pendingApproval.runId, taskId: pendingApproval.taskId, approved: false })
    } catch {
      // silent
    }
  },

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
    set({ loading: true, fetchingStatus: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.status()
      if (res.success) {
        const { run, completedCount, totalCount, failedCount, activeRuns, queuedRuns } = res.data
        set({
          runStatus: run?.status ?? null,
          sprintName: run?.sprintName ?? null,
          runId: run?.id ?? null,
          singleTaskId: run?.singleTaskId ?? null,
          completedCount,
          totalCount,
          failedCount,
          activeRuns: activeRuns ?? [],
          queuedRuns: queuedRuns ?? [],
          loading: false,
          fetchingStatus: false,
        })
      } else {
        set({ error: res.error.message, loading: false, fetchingStatus: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false, fetchingStatus: false })
    }
  },

  start: async (input: OrchestratorStartInput) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.start(input)
      if (res.success) {
        if (res.data.status === 'queued') {
          // Queued run — do NOT write singleton; the active run is unchanged.
          // Refresh arrays so queuedRuns reflects the new entry.
          await get().fetchStatus()
        } else {
          // running / paused — this becomes the focused active run
          set({
            runId: res.data.id,
            runStatus: res.data.status,
            sprintName: res.data.sprintName,
            loading: false,
          })
        }
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

  pause: async (runId?: string) => {
    const targetId = typeof runId === 'string' ? runId : get().runId
    if (!targetId) return false
    const isFocusedRun = targetId === get().runId
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.pause({ runId: targetId })
      if (res.success) {
        if (isFocusedRun) {
          set({ runStatus: 'paused', loading: false })
        } else {
          set({ loading: false })
        }
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

  resume: async (runId?: string) => {
    const targetId = typeof runId === 'string' ? runId : get().runId
    if (!targetId) return false
    const isFocusedRun = targetId === get().runId
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.resume({ runId: targetId })
      if (res.success) {
        if (isFocusedRun) {
          set({ runStatus: 'running', loading: false })
        } else {
          set({ loading: false })
        }
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

  startSingleTask: async (taskId: string, _repoId?: string, _sprintName?: string | null, _projectId?: string) => {
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
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return false
    }
  },

  cancel: async (explicitRunId?: string) => {
    const targetId = explicitRunId ?? get().runId
    if (!targetId) return
    const isActiveRun = targetId === get().runId
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.orchestrator.cancel({ runId: targetId })
      if (res.success) {
        if (isActiveRun) {
          set({ runStatus: 'cancelled', singleTaskId: null, taskProgress: new Map() })
        } else {
          // Queued run cancelled — remove from queuedRuns, leave active run untouched
          set((state) => ({
            queuedRuns: state.queuedRuns.filter((r) => r.id !== targetId),
          }))
        }
      } else {
        set({ error: res.error.message })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      set({ loading: false })
    }
  },

  handleStatusChange: (payload: OrchestratorStatusChangePayload) => {
    const { runId: activeRunId } = get()

    // No focused run OR event is for a different run — refresh arrays, never touch singleton.
    // Guard against overlapping fetches: skip if one is already in flight.
    if (!activeRunId || payload.runId !== activeRunId) {
      if (!get().fetchingStatus) {
        void get().fetchStatus()
      }
      return
    }

    // Status change for the focused active run — update singleton fields
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
        status: payload.status,
        phase: payload.phase ?? existing?.phase ?? null,
        skill: existing?.skill ?? null,
        model: existing?.model ?? null,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
      })
      return { taskProgress: next }
    })
  },

  clearError: () => set({ error: null }),
}))
