import { create } from 'zustand'
import type {
  BrainEntryStatus,
  BrainQueryResult,
  BrainTimelineEntry,
  RegisterBrainEntryInput
} from '../../../../shared/types/brain.types'

interface BrainStoreState {
  brainData: BrainQueryResult[]
  timelineData: BrainTimelineEntry[]
  loading: boolean
  error: string | null
  refreshBrainData: () => Promise<void>
  registerBrainEntry: (input: RegisterBrainEntryInput) => Promise<string>
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
      // Update the entry in-store directly — avoids re-running full discovery
      // (which can silently fail on pointer_path UNIQUE conflicts and leave stale data)
      set((state) => ({
        brainData: state.brainData.map((group) => {
          const entries = group.entries.map((e) =>
            e.id === entryId ? { ...e, status: status as BrainEntryStatus } : e
          )
          return {
            ...group,
            entries,
            summary: {
              active: entries.filter(e => e.status === 'active').length,
              notActioned: entries.filter(e => e.tasksTotal === 0 && e.status !== 'parked' && e.status !== 'implemented').length,
              parked: entries.filter(e => e.status === 'parked').length,
              implemented: entries.filter(e => e.status === 'implemented').length
            }
          }
        })
      }))
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
