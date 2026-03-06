import { create } from 'zustand'
import type { NoteItem, CreateNoteInput } from '@shared/types/note.types'

interface NoteStore {
  notes: NoteItem[]
  loading: boolean
  error: string | null

  setNotes: (notes: NoteItem[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  fetchScratchNotes: (agentId: string) => Promise<void>
  fetchRepoNotes: (repoPath: string) => Promise<void>
  fetchGlobalNotes: () => Promise<void>
  saveNote: (input: CreateNoteInput) => Promise<NoteItem | null>
  deleteNote: (id: number) => Promise<boolean>
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  loading: false,
  error: null,

  setNotes: (notes) => set({ notes }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchScratchNotes: async (agentId) => {
    set({ loading: true, error: null })
    try {
      const response = await window.agentHub.notes.getByAgent(agentId)
      if (response.success) {
        const incoming = response.data as NoteItem[]
        const existing = get().notes.filter(
          (n) => !(n.type === 'scratch' && n.agentId === agentId)
        )
        set({ notes: [...existing, ...incoming], loading: false })
      } else {
        set({ error: response.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  fetchRepoNotes: async (repoPath) => {
    set({ loading: true, error: null })
    try {
      const response = await window.agentHub.notes.getByRepo(repoPath)
      if (response.success) {
        const incoming = response.data as NoteItem[]
        const existing = get().notes.filter(
          (n) => !(n.type === 'repo' && n.repoPath === repoPath)
        )
        set({ notes: [...existing, ...incoming], loading: false })
      } else {
        set({ error: response.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  fetchGlobalNotes: async () => {
    set({ loading: true, error: null })
    try {
      const response = await window.agentHub.notes.getGlobal()
      if (response.success) {
        const incoming = response.data as NoteItem[]
        const existing = get().notes.filter((n) => n.type !== 'global')
        set({ notes: [...existing, ...incoming], loading: false })
      } else {
        set({ error: response.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  saveNote: async (input) => {
    try {
      const response = await window.agentHub.notes.save(input)
      if (response.success) {
        const saved = response.data as NoteItem
        const existing = get().notes
        const idx = existing.findIndex((n) => n.id === saved.id)
        if (idx >= 0) {
          const updated = [...existing]
          updated[idx] = saved
          set({ notes: updated })
        } else {
          set({ notes: [...existing, saved] })
        }
        return saved
      }
      set({ error: response.error.message })
      return null
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
  },

  deleteNote: async (id) => {
    try {
      const response = await window.agentHub.notes.delete(id)
      if (response.success) {
        set({ notes: get().notes.filter((n) => n.id !== id) })
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

// Helper selectors for filtering notes by type
export function selectScratchNotes(notes: NoteItem[], agentId: string): NoteItem[] {
  return notes.filter((n) => n.type === 'scratch' && n.agentId === agentId)
}

export function selectRepoNotes(notes: NoteItem[], repoPath: string): NoteItem[] {
  return notes.filter((n) => n.type === 'repo' && n.repoPath === repoPath)
}

export function selectGlobalNotes(notes: NoteItem[]): NoteItem[] {
  return notes.filter((n) => n.type === 'global')
}
