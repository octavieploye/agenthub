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
      const result = await window.agentHub.brain.query({})
      set({ brainData: result, loading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to load brain data', loading: false })
    }
  },

  registerBrainEntry: async (input) => {
    set({ loading: true, error: null })
    try {
      const result = await window.agentHub.brain.register(input)
      set({ loading: false })
      return result.entryId
    } catch (error: any) {
      set({ error: error.message || 'Failed to register brain entry', loading: false })
      throw error
    }
  },

  updateBrainEntryStatus: async (entryId, status) => {
    set({ error: null })
    try {
      await window.agentHub.brain.updateStatus(entryId, status)
      await useBrainStore.getState().refreshBrainData()
    } catch (error: any) {
      set({ error: error.message || 'Failed to update status' })
      throw error
    }
  },

  createTaskFromBrainEntry: async (brainEntryId, subject, description) => {
    set({ error: null })
    try {
      const result = await window.agentHub.brain.createTask({
        brainEntryId,
        subject,
        description
      })
      return result.taskId
    } catch (error: any) {
      set({ error: error.message || 'Failed to create task' })
      throw error
    }
  },

  getTimeline: async (repoId) => {
    set({ loading: true, error: null })
    try {
      const result = await window.agentHub.brain.timeline(repoId)
      set({ timelineData: result, loading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to load timeline', loading: false })
    }
  }
}))
