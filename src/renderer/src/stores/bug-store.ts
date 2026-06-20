import { create } from 'zustand'
import type { BugEntry, BugSeverity } from '@shared/types/bug-radar.types'

export interface CreateBugInput {
  agentId: string
  agentName: string
  repoId: string
  repoName: string
  errorType: string
  filePath: string
  message: string
  severity: BugSeverity
  projectId?: string | null
}

interface BugStore {
  bugs: BugEntry[]
  loading: boolean
  error: string | null
  hasFetched: boolean

  fetchBugs: () => Promise<void>
  fetchBugsOnce: () => Promise<void>
  createBug: (input: CreateBugInput) => Promise<boolean>
  resolveBug: (id: string) => Promise<boolean>
  deleteBug: (id: string) => Promise<boolean>
}

export const useBugStore = create<BugStore>((set, get) => ({
  bugs: [],
  loading: false,
  error: null,
  hasFetched: false,

  fetchBugsOnce: async () => {
    const state = get()
    if (state.hasFetched) return
    set({ hasFetched: true })
    await state.fetchBugs()
  },

  fetchBugs: async () => {
    set({ loading: true, error: null })
    try {
      const response = await window.agentHub.bugs.list()
      if (response.success) {
        set({ bugs: response.data, loading: false })
      } else {
        set({ error: response.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  createBug: async (input) => {
    try {
      const response = await window.agentHub.bugs.create(input)
      if (response.success) {
        set((s) => ({ bugs: [...s.bugs, response.data], hasFetched: false }))
        return true
      }
      set({ error: response.error.message })
      return false
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return false
    }
  },

  resolveBug: async (id) => {
    try {
      const response = await window.agentHub.bugs.resolve(id)
      if (response.success) {
        set((s) => ({
          bugs: s.bugs.map((b) =>
            b.id === id ? { ...b, resolvedAt: new Date().toISOString() } : b
          ),
          hasFetched: false
        }))
        return true
      }
      set({ error: response.error.message })
      return false
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return false
    }
  },

  deleteBug: async (id) => {
    try {
      const response = await window.agentHub.bugs.delete(id)
      if (response.success) {
        set((s) => ({ bugs: s.bugs.filter((b) => b.id !== id), hasFetched: false }))
        return true
      }
      set({ error: response.error.message })
      return false
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return false
    }
  }
}))
