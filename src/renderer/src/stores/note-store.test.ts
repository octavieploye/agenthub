import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNoteStore, selectScratchNotes, selectRepoNotes, selectGlobalNotes } from './note-store'
import type { NoteItem } from '@shared/types/note.types'

function makeMockNote(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    id: 1,
    type: 'scratch',
    agentId: 'agent-1',
    repoPath: null,
    content: 'Test note content',
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    ...overrides
  }
}

beforeEach(() => {
  useNoteStore.setState({ notes: [], loading: false, error: null })
  vi.restoreAllMocks()
})

describe('useNoteStore', () => {
  describe('setNotes', () => {
    it('replaces all notes', () => {
      const notes = [makeMockNote({ id: 1 }), makeMockNote({ id: 2 })]
      useNoteStore.getState().setNotes(notes)
      expect(useNoteStore.getState().notes).toHaveLength(2)
    })
  })

  describe('setLoading', () => {
    it('sets loading state', () => {
      useNoteStore.getState().setLoading(true)
      expect(useNoteStore.getState().loading).toBe(true)
    })
  })

  describe('setError', () => {
    it('sets error state', () => {
      useNoteStore.getState().setError('something broke')
      expect(useNoteStore.getState().error).toBe('something broke')
    })

    it('clears error with null', () => {
      useNoteStore.getState().setError('err')
      useNoteStore.getState().setError(null)
      expect(useNoteStore.getState().error).toBeNull()
    })
  })

  describe('fetchScratchNotes', () => {
    it('calls IPC and merges scratch notes on success', async () => {
      // Pre-populate with a global note that should be preserved
      useNoteStore.setState({
        notes: [makeMockNote({ id: 99, type: 'global', agentId: null })]
      })

      const scratchNotes = [makeMockNote({ id: 1, type: 'scratch', agentId: 'agent-1' })]
      window.agentHub = {
        notes: {
          getByAgent: vi.fn().mockResolvedValue({ success: true, data: scratchNotes })
        }
      } as any

      await useNoteStore.getState().fetchScratchNotes('agent-1')
      const state = useNoteStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('sets error on failure', async () => {
      window.agentHub = {
        notes: {
          getByAgent: vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'ERR', message: 'not found' } })
        }
      } as any

      await useNoteStore.getState().fetchScratchNotes('agent-1')
      expect(useNoteStore.getState().error).toBe('not found')
      expect(useNoteStore.getState().loading).toBe(false)
    })
  })

  describe('fetchRepoNotes', () => {
    it('calls IPC and merges repo notes on success', async () => {
      useNoteStore.setState({
        notes: [makeMockNote({ id: 99, type: 'global', agentId: null })]
      })

      const repoNotes = [
        makeMockNote({ id: 2, type: 'repo', agentId: null, repoPath: '/tmp/repo' })
      ]
      window.agentHub = {
        notes: {
          getByRepo: vi.fn().mockResolvedValue({ success: true, data: repoNotes })
        }
      } as any

      await useNoteStore.getState().fetchRepoNotes('/tmp/repo')
      const state = useNoteStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.loading).toBe(false)
    })

    it('sets error on failure', async () => {
      window.agentHub = {
        notes: {
          getByRepo: vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'ERR', message: 'db error' } })
        }
      } as any

      await useNoteStore.getState().fetchRepoNotes('/tmp/repo')
      expect(useNoteStore.getState().error).toBe('db error')
      expect(useNoteStore.getState().loading).toBe(false)
    })
  })

  describe('fetchGlobalNotes', () => {
    it('calls IPC and merges global notes on success', async () => {
      useNoteStore.setState({
        notes: [makeMockNote({ id: 1, type: 'scratch', agentId: 'agent-1' })]
      })

      const globalNotes = [
        makeMockNote({ id: 10, type: 'global', agentId: null, repoPath: null })
      ]
      window.agentHub = {
        notes: {
          getGlobal: vi.fn().mockResolvedValue({ success: true, data: globalNotes })
        }
      } as any

      await useNoteStore.getState().fetchGlobalNotes()
      const state = useNoteStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.loading).toBe(false)
    })

    it('sets error on failure', async () => {
      window.agentHub = {
        notes: {
          getGlobal: vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'ERR', message: 'timeout' } })
        }
      } as any

      await useNoteStore.getState().fetchGlobalNotes()
      expect(useNoteStore.getState().error).toBe('timeout')
      expect(useNoteStore.getState().loading).toBe(false)
    })
  })

  describe('saveNote', () => {
    it('appends new note on success', async () => {
      const saved = makeMockNote({ id: 5, content: 'new content' })
      window.agentHub = {
        notes: {
          save: vi.fn().mockResolvedValue({ success: true, data: saved })
        }
      } as any

      const result = await useNoteStore.getState().saveNote({
        type: 'scratch',
        agentId: 'agent-1',
        content: 'new content'
      })
      expect(result).toEqual(saved)
      expect(useNoteStore.getState().notes).toHaveLength(1)
      expect(useNoteStore.getState().notes[0].id).toBe(5)
    })

    it('updates existing note with same id on success', async () => {
      useNoteStore.setState({
        notes: [makeMockNote({ id: 5, content: 'old content' })]
      })

      const updated = makeMockNote({ id: 5, content: 'updated content' })
      window.agentHub = {
        notes: {
          save: vi.fn().mockResolvedValue({ success: true, data: updated })
        }
      } as any

      const result = await useNoteStore.getState().saveNote({
        type: 'scratch',
        agentId: 'agent-1',
        content: 'updated content'
      })
      expect(result).toEqual(updated)
      expect(useNoteStore.getState().notes).toHaveLength(1)
      expect(useNoteStore.getState().notes[0].content).toBe('updated content')
    })

    it('returns null and sets error on failure', async () => {
      window.agentHub = {
        notes: {
          save: vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'ERR', message: 'save failed' } })
        }
      } as any

      const result = await useNoteStore.getState().saveNote({
        type: 'scratch',
        agentId: 'agent-1',
        content: 'content'
      })
      expect(result).toBeNull()
      expect(useNoteStore.getState().error).toBe('save failed')
    })
  })

  describe('deleteNote', () => {
    it('removes note on success', async () => {
      useNoteStore.setState({
        notes: [makeMockNote({ id: 1 }), makeMockNote({ id: 2 })]
      })
      window.agentHub = {
        notes: {
          delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
        }
      } as any

      const result = await useNoteStore.getState().deleteNote(1)
      expect(result).toBe(true)
      expect(useNoteStore.getState().notes).toHaveLength(1)
      expect(useNoteStore.getState().notes[0].id).toBe(2)
    })

    it('returns false and sets error on failure', async () => {
      useNoteStore.setState({ notes: [makeMockNote({ id: 1 })] })
      window.agentHub = {
        notes: {
          delete: vi.fn().mockResolvedValue({
            success: false,
            error: { code: 'ERR', message: 'delete failed' }
          })
        }
      } as any

      const result = await useNoteStore.getState().deleteNote(1)
      expect(result).toBe(false)
      expect(useNoteStore.getState().error).toBe('delete failed')
      expect(useNoteStore.getState().notes).toHaveLength(1)
    })
  })
})

describe('helper selectors', () => {
  it('selectScratchNotes filters by type and agentId', () => {
    const notes: NoteItem[] = [
      makeMockNote({ id: 1, type: 'scratch', agentId: 'agent-1' }),
      makeMockNote({ id: 2, type: 'scratch', agentId: 'agent-2' }),
      makeMockNote({ id: 3, type: 'repo', agentId: null, repoPath: '/tmp/r' }),
      makeMockNote({ id: 4, type: 'global', agentId: null })
    ]
    const result = selectScratchNotes(notes, 'agent-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('selectRepoNotes filters by type and repoPath', () => {
    const notes: NoteItem[] = [
      makeMockNote({ id: 1, type: 'scratch', agentId: 'agent-1' }),
      makeMockNote({ id: 2, type: 'repo', agentId: null, repoPath: '/tmp/r1' }),
      makeMockNote({ id: 3, type: 'repo', agentId: null, repoPath: '/tmp/r2' }),
      makeMockNote({ id: 4, type: 'global', agentId: null })
    ]
    const result = selectRepoNotes(notes, '/tmp/r1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(2)
  })

  it('selectGlobalNotes filters by type global', () => {
    const notes: NoteItem[] = [
      makeMockNote({ id: 1, type: 'scratch', agentId: 'agent-1' }),
      makeMockNote({ id: 2, type: 'global', agentId: null }),
      makeMockNote({ id: 3, type: 'global', agentId: null })
    ]
    const result = selectGlobalNotes(notes)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(2)
    expect(result[1].id).toBe(3)
  })

  it('returns empty array when no matching notes exist', () => {
    const notes: NoteItem[] = [
      makeMockNote({ id: 1, type: 'global', agentId: null })
    ]
    expect(selectScratchNotes(notes, 'agent-1')).toEqual([])
    expect(selectRepoNotes(notes, '/tmp/r')).toEqual([])
    expect(selectGlobalNotes([])).toEqual([])
  })
})
