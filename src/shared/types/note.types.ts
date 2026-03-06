export type NoteType = 'scratch' | 'repo' | 'global'

export interface NoteItem {
  id: number
  type: NoteType
  agentId: string | null
  repoPath: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreateNoteInput {
  type: NoteType
  agentId?: string
  repoPath?: string
  content: string
}

export interface UpdateNoteInput {
  content: string
}
