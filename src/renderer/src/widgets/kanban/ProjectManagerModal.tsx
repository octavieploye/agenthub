import { useState, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../stores/project-store'
import type { Project } from '@shared/types/project.types'
import type { RepoConfig } from '@shared/types/config.types'

interface ProjectManagerModalProps {
  isOpen: boolean
  onClose: () => void
}

interface EditState {
  name: string
  description: string
}

// projectId -> Set of linked repoIds
type LinkedReposMap = Record<string, Set<string>>

async function fetchAllRepos(): Promise<RepoConfig[]> {
  const response = await window.agentHub.db.getRepos()
  return response.success ? response.data : []
}

async function buildLinkedReposMap(
  repos: RepoConfig[],
  projects: Project[]
): Promise<LinkedReposMap> {
  const map: LinkedReposMap = {}
  for (const project of projects) {
    map[project.id] = new Set()
  }
  for (const repo of repos) {
    const response = await window.agentHub.projects.getByRepo(repo.id)
    if (!response.success) continue
    for (const project of response.data) {
      if (!map[project.id]) map[project.id] = new Set()
      map[project.id].add(repo.id)
    }
  }
  return map
}

export function ProjectManagerModal({ isOpen, onClose }: ProjectManagerModalProps) {
  const {
    projects,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    linkRepo,
    unlinkRepo
  } = useProjectStore()

  const [repos, setRepos] = useState<RepoConfig[]>([])
  const [linkedReposMap, setLinkedReposMap] = useState<LinkedReposMap>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ name: '', description: '' })
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshLinkedMap = useCallback(
    async (currentRepos: RepoConfig[], currentProjects: Project[]) => {
      const map = await buildLinkedReposMap(currentRepos, currentProjects)
      setLinkedReposMap(map)
    },
    []
  )

  const loadData = useCallback(async () => {
    await fetchProjects()
    const allRepos = await fetchAllRepos()
    setRepos(allRepos)
  }, [fetchProjects])

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setEditingId(null)
    setCreateName('')
    setCreateDescription('')
    loadData()
  }, [isOpen, loadData])

  useEffect(() => {
    if (projects.length === 0 && repos.length === 0) return
    refreshLinkedMap(repos, projects)
  }, [projects, repos, refreshLinkedMap])

  function startEdit(project: Project) {
    setEditingId(project.id)
    setEditState({ name: project.name, description: project.description ?? '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState({ name: '', description: '' })
  }

  async function handleCreate() {
    if (!createName.trim()) return
    setBusy(true)
    setError(null)
    const result = await createProject({
      name: createName.trim(),
      description: createDescription.trim() || undefined
    })
    setBusy(false)
    if (!result) {
      setError('Failed to create project.')
      return
    }
    setCreateName('')
    setCreateDescription('')
  }

  async function handleUpdate(projectId: string) {
    if (!editState.name.trim()) return
    setBusy(true)
    setError(null)
    const ok = await updateProject(projectId, {
      name: editState.name.trim(),
      description: editState.description.trim() || null
    })
    setBusy(false)
    if (!ok) {
      setError('Failed to update project.')
      return
    }
    cancelEdit()
  }

  async function handleDelete(projectId: string) {
    if (!window.confirm('Delete this project? This cannot be undone.')) return
    setBusy(true)
    setError(null)
    await deleteProject(projectId)
    setBusy(false)
  }

  async function handleRepoToggle(projectId: string, repoId: string, currentlyLinked: boolean) {
    setBusy(true)
    if (currentlyLinked) {
      await unlinkRepo(projectId, repoId)
    } else {
      await linkRepo(projectId, repoId)
    }
    const updatedRepos = await fetchAllRepos()
    await refreshLinkedMap(updatedRepos, projects)
    setBusy(false)
  }

  if (!isOpen) return null

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl max-h-[80vh] overflow-y-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Project Manager</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <div className="alert alert-error text-sm py-2">
            <span>{error}</span>
          </div>
        )}

        {/* Create form */}
        <div className="border border-base-300 rounded-lg p-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-base-content/70">New Project</p>
          <input
            type="text"
            className="input input-sm input-bordered w-full"
            placeholder="Project name (required)"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
          <textarea
            className="textarea textarea-bordered textarea-sm w-full resize-none"
            placeholder="Description (optional)"
            rows={2}
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              className="btn btn-sm btn-primary"
              onClick={handleCreate}
              disabled={busy || !createName.trim()}
            >
              {busy && <span className="loading loading-spinner loading-xs" />}
              Create
            </button>
          </div>
        </div>

        {/* Project list */}
        {projects.length === 0 ? (
          <p className="text-sm text-base-content/50 text-center py-4">No projects yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                repos={repos}
                linkedRepoIds={linkedReposMap[project.id] ?? new Set()}
                isEditing={editingId === project.id}
                editState={editState}
                busy={busy}
                onStartEdit={() => startEdit(project)}
                onCancelEdit={cancelEdit}
                onEditStateChange={setEditState}
                onSaveEdit={() => handleUpdate(project.id)}
                onDelete={() => handleDelete(project.id)}
                onRepoToggle={(repoId, linked) => handleRepoToggle(project.id, repoId, linked)}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

interface ProjectRowProps {
  project: Project
  repos: RepoConfig[]
  linkedRepoIds: Set<string>
  isEditing: boolean
  editState: EditState
  busy: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onEditStateChange: (state: EditState) => void
  onSaveEdit: () => void
  onDelete: () => void
  onRepoToggle: (repoId: string, currentlyLinked: boolean) => void
}

function ProjectRow({
  project,
  repos,
  linkedRepoIds,
  isEditing,
  editState,
  busy,
  onStartEdit,
  onCancelEdit,
  onEditStateChange,
  onSaveEdit,
  onDelete,
  onRepoToggle
}: ProjectRowProps) {
  return (
    <li className="border border-base-300 rounded-lg p-3 flex flex-col gap-2">
      {!isEditing && (
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium text-sm truncate">{project.name}</span>
            {project.description && (
              <span className="text-xs text-base-content/60 line-clamp-2">
                {project.description}
              </span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button className="btn btn-xs btn-ghost" onClick={onStartEdit} disabled={busy}>
              Edit
            </button>
            <button
              className="btn btn-xs btn-ghost text-error"
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            className="input input-sm input-bordered w-full"
            value={editState.name}
            onChange={(e) => onEditStateChange({ ...editState, name: e.target.value })}
            placeholder="Project name"
          />
          <textarea
            className="textarea textarea-bordered textarea-sm w-full resize-none"
            rows={2}
            value={editState.description}
            onChange={(e) => onEditStateChange({ ...editState, description: e.target.value })}
            placeholder="Description (optional)"
          />

          {repos.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                Linked Repositories
              </p>
              <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {repos.map((repo) => {
                  const linked = linkedRepoIds.has(repo.id)
                  return (
                    <li key={repo.id}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={linked}
                          onChange={() => onRepoToggle(repo.id, linked)}
                          disabled={busy}
                        />
                        <span className="text-xs font-medium">{repo.name}</span>
                        <span className="text-xs text-base-content/40 truncate max-w-xs">
                          {repo.path}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn btn-xs btn-ghost" onClick={onCancelEdit} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn btn-xs btn-primary"
              onClick={onSaveEdit}
              disabled={busy || !editState.name.trim()}
            >
              {busy && <span className="loading loading-spinner loading-xs" />}
              Save
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
