import { useState, useEffect } from 'react'
import { buildSprintDecompositionPrompt } from '../../helpers/sprint-decomposition-prompt'
import type { RepoConfig } from '@shared/types/config.types'
import type { Project } from '@shared/types/project.types'

interface SprintIntakeModalProps {
  isOpen: boolean
  onClose: () => void
  intakeDir: string
}

export function SprintIntakeModal({ isOpen, onClose, intakeDir }: SprintIntakeModalProps) {
  const [docPath, setDocPath] = useState('')
  const [repos, setRepos] = useState<RepoConfig[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [pickingFolder, setPickingFolder] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    window.agentHub.db.getRepos().then((res) => {
      if (res.success) {
        setRepos(res.data)
        if (res.data.length > 0 && !selectedRepoId) setSelectedRepoId(res.data[0].id)
      }
    })
    window.agentHub.projects.list().then((res) => {
      if (res.success) setProjects(res.data)
    })
  }, [isOpen])

  function handleProjectChange(projectId: string): void {
    setSelectedProjectId(projectId)
    const project = projects.find((p) => p.id === projectId)
    setProjectPath(project?.path ?? null)
  }

  async function handlePickFolder(): Promise<void> {
    setPickingFolder(true)
    const res = await window.agentHub.dialog.openDirectory()
    setPickingFolder(false)
    if (!res.success || !res.data) return
    setProjectPath(res.data)
    if (selectedProjectId) {
      await window.agentHub.projects.update(selectedProjectId, { path: res.data })
    }
  }

  async function handleLaunch(): Promise<void> {
    const path = docPath.trim()
    if (!path || !selectedProjectId || !selectedRepoId) {
      setError('Document path, project, and repo are all required.')
      return
    }
    if (!projectPath) {
      setError('Set a project folder first — the agent needs a place to write sprint.md.')
      return
    }
    const repo = repos.find((r) => r.id === selectedRepoId)
    const project = projects.find((p) => p.id === selectedProjectId)
    if (!repo || !project) return

    setLaunching(true)
    setError(null)

    const draftFilename = `sprint-${selectedProjectId}.draft.json`
    const taskDescription = buildSprintDecompositionPrompt({
      docPath: path,
      projectName: project.name,
      repoId: selectedRepoId,
      outputPath: intakeDir,
      projectPath,
      draftFilename
    })

    const res = await window.agentHub.agents.spawn({
      repoId: selectedRepoId,
      name: `Sprint intake — ${project.name}`,
      cwd: projectPath,
      taskDescription
    })
    setLaunching(false)
    if (!res.success) {
      setError(res.error?.message ?? 'Spawn failed')
      return
    }
    onClose()
  }

  if (!isOpen) return null

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const needsPath = selectedProjectId && !projectPath

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel-glass flex flex-col w-full max-w-md rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/10">
          <span className="text-sm font-semibold">Sprint Intake — Launch Decomposition Agent</span>
          <button className="btn btn-xs btn-ghost text-base-content/60" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/60">Sprint / Brief document path</label>
            <input
              type="text"
              placeholder="/path/to/sprint.md or brief.txt"
              value={docPath}
              onChange={(e) => setDocPath(e.target.value)}
              className="input input-bordered input-sm w-full bg-base-100/50 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/60">Project</label>
            <select
              className="select select-bordered select-sm w-full bg-base-100/50"
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              <option value="">— Select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {needsPath && (
              <div className="flex items-center gap-2 mt-1 p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
                <span className="flex-1">No project folder set — needed to write sprint.md</span>
                <button
                  className="btn btn-xs btn-warning"
                  onClick={handlePickFolder}
                  disabled={pickingFolder}
                >
                  {pickingFolder ? 'Picking…' : 'Set folder'}
                </button>
              </div>
            )}

            {projectPath && selectedProject && (
              <div className="flex items-center gap-2 mt-1 text-[10px] text-base-content/40">
                <span className="truncate flex-1" title={projectPath}>
                  {projectPath}
                </span>
                <button
                  className="btn btn-xs btn-ghost shrink-0"
                  onClick={handlePickFolder}
                  disabled={pickingFolder}
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/60">Repo</label>
            <select
              className="select select-bordered select-sm w-full bg-base-100/50"
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="text-[10px] text-base-content/40 border border-base-content/10 rounded p-2">
            The agent reads your doc, writes sprint.md to the project folder, and writes a draft
            JSON to AgentHub. When it finishes, a &quot;draft ready&quot; indicator appears next to
            the Sprint ↑ button.
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-base-content/10">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleLaunch}
            disabled={
              launching || !docPath.trim() || !selectedRepoId || !selectedProjectId || !projectPath
            }
          >
            {launching ? 'Launching…' : 'Launch Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
