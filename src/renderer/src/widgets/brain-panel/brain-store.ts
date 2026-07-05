import { create } from 'zustand'
import { BrainEntry, BrainQueryResult, BrainTimelineEntry } from '../../../../shared/types/brain.types'

interface BrainStoreState {
  brainData: BrainQueryResult[]
  timelineData: BrainTimelineEntry[]
  loading: boolean
  error: string | null
  refreshBrainData: () => Promise<void>
  registerBrainEntry: (input: {
    repoId: string
    subject: string
    type: string
    artifactPath: string
    project?: string
    note?: string
  }) => Promise<string>
  updateBrainEntryStatus: (entryId: string, status: string) => Promise<void>
  createTaskFromBrainEntry: (brainEntryId: string, subject?: string, description?: string) => Promise<string>
  getTimeline: (repoId: string) => Promise<void>
}

export const useBrainStore = create<BrainStoreState>((set) => ({
  brainData: [],
  timelineData: [],
  loading: false,
  error: null,

  refreshBrainData: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.electron.ipcRenderer.invoke('brain:query', {})
      set({ brainData: result, loading: false })
    } catch (error) {
      set({ error: error.message || 'Failed to load brain data', loading: false })
    }
  },

  registerBrainEntry: async (input) => {
    set({ loading: true, error: null })
    try {
      const result = await window.electron.ipcRenderer.invoke('brain:register', input)
      set({ loading: false })
      return result.entryId
    } catch (error) {
      set({ error: error.message || 'Failed to register brain entry', loading: false })
      throw error
    }
  },

  updateBrainEntryStatus: async (entryId, status) => {
    set({ loading: true, error: null })
    try {
      await window.electron.ipcRenderer.invoke('brain:update-status', { id: entryId, status })
      await useBrainStore.getState().refreshBrainData()
      set({ loading: false })
    } catch (error) {
      set({ error: error.message || 'Failed to update status', loading: false })
      throw error
    }
  },

  createTaskFromBrainEntry: async (brainEntryId, subject, description) => {
    set({ loading: true, error: null })
    try {
      const result = await window.electron.ipcRenderer.invoke('brain:create-task', {
        brainEntryId,
        subject,
        description
      })
      set({ loading: false })
      return result.taskId
    } catch (error) {
      set({ error: error.message || 'Failed to create task', loading: false })
      throw error
    }
  },

  getTimeline: async (repoId) => {
    set({ loading: true, error: null })
    try {
      const result = await window.electron.ipcRenderer.invoke('brain:timeline', { repoId })
      set({ timelineData: result, loading: false })
    } catch (error) {
      set({ error: error.message || 'Failed to load timeline', loading: false })
    }
  }
}))