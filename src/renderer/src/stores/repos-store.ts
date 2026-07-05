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
      const repos = await window.electron.ipcRenderer.invoke('db:get-repos', {})
      set({ repos, loading: false })
    } catch (error) {
      set({ error: error.message || 'Failed to fetch repos', loading: false })
    }
  }
}))