export interface Project {
  id: string
  name: string
  description: string | null
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
}

export interface UpdateProjectInput {
  name?: string
  description?: string | null
}
