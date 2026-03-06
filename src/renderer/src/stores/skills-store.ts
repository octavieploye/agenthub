import { create } from 'zustand'
import type { SkillItem, SkillExecutionResult } from '@shared/types/skills.types'

interface SkillsStore {
  skills: SkillItem[]
  loading: boolean
  executing: string | null
  lastResult: SkillExecutionResult | null
  error: string | null
  searchFilter: string

  fetchSkills: (repoPath?: string) => Promise<void>
  executeSkill: (skillId: string, repoPath?: string) => Promise<boolean>
  refreshSkills: (repoPath?: string) => Promise<void>
  setSearchFilter: (filter: string) => void
  clearError: () => void
  clearResult: () => void
}

export const useSkillsStore = create<SkillsStore>((set) => ({
  skills: [],
  loading: false,
  executing: null,
  lastResult: null,
  error: null,
  searchFilter: '',

  fetchSkills: async (repoPath?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.skills.list(repoPath)
      if (res.success) {
        set({ skills: res.data, loading: false })
      } else {
        set({ error: res.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  executeSkill: async (skillId: string, repoPath?: string) => {
    set({ executing: skillId, error: null, lastResult: null })
    try {
      const res = await window.agentHub.skills.execute(skillId, repoPath)
      if (res.success) {
        set({ lastResult: res.data, executing: null })
        return true
      } else {
        set({ error: res.error.message, executing: null })
        return false
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), executing: null })
      return false
    }
  },

  refreshSkills: async (repoPath?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.agentHub.skills.refresh(repoPath)
      if (res.success) {
        set({ skills: res.data, loading: false })
      } else {
        set({ error: res.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  setSearchFilter: (filter: string) => set({ searchFilter: filter }),
  clearError: () => set({ error: null }),
  clearResult: () => set({ lastResult: null })
}))
