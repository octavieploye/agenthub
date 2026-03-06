export interface ClipItem {
  id: string
  title: string
  description: string
  prompt: string
  defaultRepoId: string | null
  launchCount: number
  lastUsedAt: string | null
  createdAt: string
}

export interface CreateClipInput {
  title: string
  description: string
  prompt: string
  defaultRepoId?: string
}
