import { create } from 'zustand'
import type { Project, CreateProjectInput, UpdateProjectInput } from '@shared/types/project.types'

interface ProjectStore {
  projects: Project[]
  selectedProjectId: string | null

  fetchProjects: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<Project | null>
  updateProject: (id: string, input: UpdateProjectInput) => Promise<boolean>
  deleteProject: (id: string) => Promise<boolean>
  selectProject: (id: string | null) => void
  linkRepo: (projectId: string, repoId: string) => Promise<boolean>
  unlinkRepo: (projectId: string, repoId: string) => Promise<boolean>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  selectedProjectId: null,

  fetchProjects: async () => {
    try {
      const response = await window.agentHub.projects.list()
      if (response.success) {
        set({ projects: response.data })
      }
    } catch (err) {
      console.error('[project-store] fetchProjects failed:', err)
    }
  },

  createProject: async (input) => {
    try {
      const response = await window.agentHub.projects.create(input)
      if (response.success) {
        await get().fetchProjects()
        return response.data
      }
      return null
    } catch (err) {
      console.error('[project-store] createProject failed:', err)
      return null
    }
  },

  updateProject: async (id, input) => {
    try {
      const response = await window.agentHub.projects.update(id, input)
      if (response.success) {
        await get().fetchProjects()
        return true
      }
      return false
    } catch (err) {
      console.error('[project-store] updateProject failed:', err)
      return false
    }
  },

  deleteProject: async (id) => {
    try {
      const response = await window.agentHub.projects.delete(id)
      if (response.success) {
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          selectedProjectId: s.selectedProjectId === id ? null : s.selectedProjectId
        }))
        return true
      }
      return false
    } catch (err) {
      console.error('[project-store] deleteProject failed:', err)
      return false
    }
  },

  selectProject: (id) => set({ selectedProjectId: id }),

  linkRepo: async (projectId, repoId) => {
    try {
      const response = await window.agentHub.projects.linkRepo(projectId, repoId)
      return response.success === true
    } catch (err) {
      console.error('[project-store] linkRepo failed:', err)
      return false
    }
  },

  unlinkRepo: async (projectId, repoId) => {
    try {
      const response = await window.agentHub.projects.unlinkRepo(projectId, repoId)
      return response.success === true
    } catch (err) {
      console.error('[project-store] unlinkRepo failed:', err)
      return false
    }
  }
}))
