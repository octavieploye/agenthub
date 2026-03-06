import { create } from 'zustand'
import type { ClipItem, CreateClipInput } from '@shared/types/clip.types'

interface ClipStore {
  clips: ClipItem[]
  loading: boolean
  error: string | null

  fetchClips: () => Promise<void>
  createClip: (input: CreateClipInput) => Promise<ClipItem | null>
  deleteClip: (id: string) => Promise<boolean>
  launchClip: (id: string) => Promise<void>
}

export const useClipStore = create<ClipStore>((set) => ({
  clips: [],
  loading: false,
  error: null,

  fetchClips: async () => {
    set({ loading: true, error: null })
    try {
      const response = await window.agentHub.clips.list()
      if (response.success) {
        set({ clips: response.data as ClipItem[], loading: false })
      } else {
        set({ error: response.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  createClip: async (input) => {
    try {
      const response = await window.agentHub.clips.create(input)
      if (response.success) {
        const clip = response.data as ClipItem
        set((s) => ({ clips: [clip, ...s.clips] }))
        return clip
      }
      set({ error: response.error.message })
      return null
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
  },

  deleteClip: async (id) => {
    try {
      const response = await window.agentHub.clips.delete(id)
      if (response.success) {
        set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }))
        return true
      }
      set({ error: response.error.message })
      return false
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return false
    }
  },

  launchClip: async (id) => {
    try {
      await window.agentHub.clips.recordLaunch(id)
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === id
            ? { ...c, launchCount: c.launchCount + 1, lastUsedAt: new Date().toISOString() }
            : c
        )
      }))
    } catch {
      // non-critical — clip still launches
    }
  }
}))
