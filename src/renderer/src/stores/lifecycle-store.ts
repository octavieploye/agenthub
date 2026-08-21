import { create } from 'zustand'
import type {
  LifecycleMetrics,
  LayerDistribution,
  LifecycleHistoryEntry,
  ArchivedPage,
  LifecycleRunResult,
  RestoreResult,
  PolicyUpdateRequest,
  PolicyResponse,
} from '@shared/types/lifecycle.types'

interface LifecycleStore {
  // State
  metrics: LifecycleMetrics | null
  distribution: LayerDistribution[]
  history: LifecycleHistoryEntry[]
  archived: ArchivedPage | null
  loading: boolean
  error: string | null
  hasFetchedOnce: boolean

  // Actions
  fetchMetrics: () => Promise<void>
  fetchDistribution: () => Promise<void>
  fetchHistory: (limit?: number) => Promise<void>
  fetchArchived: (params?: { layer?: string; page?: number; page_size?: number }) => Promise<void>
  updatePolicy: (layer: string, policy: PolicyUpdateRequest) => Promise<PolicyResponse | null>
  runCycle: () => Promise<LifecycleRunResult | null>
  restoreRecord: (archiveId: string) => Promise<RestoreResult | null>
  fetchAll: () => Promise<void>
  clearError: () => void
}

export const useLifecycleStore = create<LifecycleStore>((set, get) => ({
  metrics: null,
  distribution: [],
  history: [],
  archived: null,
  loading: false,
  error: null,
  hasFetchedOnce: false,

  fetchMetrics: async () => {
    try {
      const res = await window.agentHub.lifecycle.getMetrics()
      if (res.success) {
        set({ metrics: res.data })
      }
    } catch {
      // non-critical — keep stale data
    }
  },

  fetchDistribution: async () => {
    try {
      const res = await window.agentHub.lifecycle.getDistribution()
      if (res.success) {
        set({ distribution: res.data })
      }
    } catch {
      // non-critical
    }
  },

  fetchHistory: async (limit?: number) => {
    try {
      const res = await window.agentHub.lifecycle.getHistory(limit)
      if (res.success) {
        set({ history: res.data })
      }
    } catch {
      // non-critical
    }
  },

  fetchArchived: async (params?) => {
    try {
      const res = await window.agentHub.lifecycle.getArchived(params)
      if (res.success) {
        set({ archived: res.data })
      }
    } catch {
      // non-critical
    }
  },

  updatePolicy: async (layer, policy) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.lifecycle.updatePolicy(layer, policy)
      if (res.success) {
        set({ loading: false })
        return res.data
      }
      set({ error: res.error.message, loading: false })
      return null
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return null
    }
  },

  runCycle: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.lifecycle.runCycle()
      if (res.success) {
        set({ loading: false })
        // Refresh metrics after a cycle
        get().fetchMetrics()
        get().fetchHistory()
        return res.data
      }
      set({ error: res.error.message, loading: false })
      return null
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return null
    }
  },

  restoreRecord: async (archiveId) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.lifecycle.restore(archiveId)
      if (res.success) {
        set({ loading: false })
        // Refresh archived list and metrics
        get().fetchArchived()
        get().fetchMetrics()
        return res.data
      }
      set({ error: res.error.message, loading: false })
      return null
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return null
    }
  },

  fetchAll: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const [metricsRes, distRes, histRes] = await Promise.allSettled([
        window.agentHub.lifecycle.getMetrics(),
        window.agentHub.lifecycle.getDistribution(),
        window.agentHub.lifecycle.getHistory(10),
      ])

      const updates: Partial<LifecycleStore> = { loading: false, hasFetchedOnce: true }

      if (metricsRes.status === 'fulfilled' && metricsRes.value.success) {
        updates.metrics = metricsRes.value.data
      }
      if (distRes.status === 'fulfilled' && distRes.value.success) {
        updates.distribution = distRes.value.data
      }
      if (histRes.status === 'fulfilled' && histRes.value.success) {
        updates.history = histRes.value.data
      }

      // If all three failed, report error
      if (
        metricsRes.status === 'rejected' &&
        distRes.status === 'rejected' &&
        histRes.status === 'rejected'
      ) {
        updates.error = 'Anamnesis server unreachable'
      }

      set(updates)
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
        hasFetchedOnce: true,
      })
    }
  },

  clearError: () => set({ error: null }),
}))
