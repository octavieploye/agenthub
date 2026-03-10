import { create } from 'zustand'
import type { HistoryEntry } from '@shared/types/history.types'

interface HistoryStore {
  entries: HistoryEntry[]
  loading: boolean
  hasFetched: Map<string, boolean>

  fetchHistory: (agentId: string) => Promise<void>
  searchHistory: (agentId: string, query: string) => Promise<void>
  fetchHistoryOnce: (agentId: string) => Promise<void>
  resetFetchFlag: (agentId: string) => void
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: [],
  loading: false,
  hasFetched: new Map(),

  fetchHistory: async (agentId: string) => {
    set({ loading: true })
    try {
      const response = await window.agentHub.history.get(agentId)
      if (response.success) {
        set({ entries: response.data, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  searchHistory: async (agentId: string, query: string) => {
    set({ loading: true })
    try {
      const response = await window.agentHub.history.search(agentId, query)
      if (response.success) {
        set({
          entries: response.data.map((r) => ({
            id: r.id,
            agentId: r.agentId,
            content: r.content,
            createdAt: r.createdAt
          })),
          loading: false
        })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  fetchHistoryOnce: async (agentId: string) => {
    const { hasFetched } = get()
    if (hasFetched.get(agentId)) return
    const newMap = new Map(hasFetched)
    newMap.set(agentId, true)
    set({ hasFetched: newMap })
    await get().fetchHistory(agentId)
  },

  resetFetchFlag: (agentId: string) => {
    const newMap = new Map(get().hasFetched)
    newMap.delete(agentId)
    set({ hasFetched: newMap })
  }
}))
