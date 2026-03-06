export interface HistoryEntry {
  id: number
  agentId: string
  content: string
  createdAt: string
}

export interface HistorySearchResult {
  id: number
  agentId: string
  content: string
  createdAt: string
  rank: number
}
