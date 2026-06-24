export interface Project {
  id: string
  name: string
  description: string | null
  path: string | null
  contextDoc: string | null
  contextDocUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectRepo {
  projectId: string
  repoId: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  path?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string | null
  path?: string | null
  contextDoc?: string | null
}
