import { create } from 'zustand'
import { RepoConfig } from '@shared/types/config.types'

interface ReposStore {
  repos: RepoConfig[]
  loading: boolean
  error: string | null
  fetchRepos: () => Promise<void>
}

export const useReposStore = create<ReposStore>((set) => ({
  repos: [],
  loading: false,
  error: null,

  fetchRepos: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.db.getRepos()
      if (res.success) {
        set({ repos: res.data, loading: false })
      } else {
        set({ error: res.error?.message || 'Failed to fetch repos', loading: false })
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch repos', loading: false })
    }
  }
}))