export interface WorkspaceMemoryEntry {
  id: string
  projectId: string
  content: string
  sourceId: string | null
  createdAt: string
  pinnedAt: string
  anamnesisId: string | null
  syncedToAnamnesis: number
}
