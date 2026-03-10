import { create } from 'zustand'
import type {
  GitRepoStatus,
  GitCommitEntry,
  GitDiffResult,
  GitBranchInfo
} from '@shared/types/git.types'

interface GitStore {
  status: GitRepoStatus | null
  diff: GitDiffResult | null
  log: GitCommitEntry[]
  branches: GitBranchInfo | null
  suggestedMessage: string
  loading: boolean
  error: string | null
  hasFetchedForRepo: Set<string>

  fetchStatus: (repoPath: string) => Promise<void>
  fetchDiff: (repoPath: string, staged?: boolean) => Promise<void>
  fetchLog: (repoPath: string, limit?: number) => Promise<void>
  fetchBranches: (repoPath: string) => Promise<void>
  fetchGitDataOnce: (repoPath: string) => Promise<void>
  resetGitFetchFlag: (repoPath: string) => void
  fetchSuggestedMessage: (repoPath: string) => Promise<void>
  stageFiles: (repoPath: string, files: string[]) => Promise<boolean>
  unstageFiles: (repoPath: string, files: string[]) => Promise<boolean>
  commit: (repoPath: string, message: string) => Promise<boolean>
  push: (repoPath: string, branch?: string) => Promise<boolean>
  pull: (repoPath: string) => Promise<boolean>
  clearError: () => void
}

export const useGitStore = create<GitStore>((set, get) => ({
  status: null,
  diff: null,
  log: [],
  branches: null,
  suggestedMessage: '',
  loading: false,
  error: null,
  hasFetchedForRepo: new Set<string>(),

  fetchGitDataOnce: async (repoPath: string) => {
    const { hasFetchedForRepo } = get()
    if (hasFetchedForRepo.has(repoPath)) {
      console.log('[DEBUG-TAB] fetchGitDataOnce SKIPPED (already fetched)', repoPath)
      return
    }
    console.log('[DEBUG-TAB] fetchGitDataOnce START', repoPath)
    const t0 = performance.now()
    const newSet = new Set(hasFetchedForRepo)
    newSet.add(repoPath)
    set({ hasFetchedForRepo: newSet })
    await Promise.all([
      get().fetchStatus(repoPath),
      get().fetchLog(repoPath, 20),
      get().fetchBranches(repoPath)
    ])
    console.log(`[DEBUG-TAB] fetchGitDataOnce END — ${(performance.now() - t0).toFixed(1)}ms`)
  },

  resetGitFetchFlag: (repoPath: string) => {
    const newSet = new Set(get().hasFetchedForRepo)
    newSet.delete(repoPath)
    set({ hasFetchedForRepo: newSet })
  },

  fetchStatus: async (repoPath: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.git.getStatus(repoPath)
      if (res.success) {
        set({ status: res.data, loading: false })
      } else {
        set({ error: res.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  fetchDiff: async (repoPath: string, staged?: boolean) => {
    try {
      const res = await window.agentHub.git.getDiff({ repoPath, staged })
      if (res.success) {
        set({ diff: res.data })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchLog: async (repoPath: string, limit?: number) => {
    try {
      const res = await window.agentHub.git.getLog({ repoPath, limit })
      if (res.success) {
        set({ log: res.data })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchBranches: async (repoPath: string) => {
    try {
      const res = await window.agentHub.git.getBranches(repoPath)
      if (res.success) {
        set({ branches: res.data })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchSuggestedMessage: async (repoPath: string) => {
    try {
      const res = await window.agentHub.git.suggestCommit(repoPath)
      if (res.success) {
        set({ suggestedMessage: res.data })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  stageFiles: async (repoPath: string, files: string[]) => {
    try {
      const res = await window.agentHub.git.stageFiles({ repoPath, files })
      return res.success
    } catch {
      return false
    }
  },

  unstageFiles: async (repoPath: string, files: string[]) => {
    try {
      const res = await window.agentHub.git.unstageFiles({ repoPath, files })
      return res.success
    } catch {
      return false
    }
  },

  commit: async (repoPath: string, message: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.git.commit({ repoPath, message })
      if (res.success) {
        get().resetGitFetchFlag(repoPath)
      }
      set({ loading: false })
      return res.success
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return false
    }
  },

  push: async (repoPath: string, branch?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.git.push({ repoPath, branch })
      if (res.success) {
        get().resetGitFetchFlag(repoPath)
      }
      set({ loading: false })
      return res.success
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return false
    }
  },

  pull: async (repoPath: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.git.pull(repoPath)
      if (res.success) {
        get().resetGitFetchFlag(repoPath)
      }
      set({ loading: false })
      return res.success
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
      return false
    }
  },

  clearError: () => set({ error: null })
}))
