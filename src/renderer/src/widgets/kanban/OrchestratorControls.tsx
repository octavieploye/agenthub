import { useEffect, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw, X } from 'lucide-react'
import { useOrchestratorStore } from '../../stores/orchestrator-store'
import type { OrchestratorRunStatus } from '@shared/types/orchestrator.types'
import type { RepoConfig } from '@shared/types/config.types'

interface OrchestratorControlsProps {
  repos: RepoConfig[]
  selectedProjectId: string | null
}

const STATUS_BADGE: Record<OrchestratorRunStatus, string> = {
  idle: 'badge-ghost',
  running: 'badge-success',
  paused: 'badge-warning',
  completed: 'badge-info',
  failed: 'badge-error',
}

export function OrchestratorControls({ repos, selectedProjectId }: OrchestratorControlsProps) {
  const {
    runStatus,
    sprintName,
    runId,
    singleTaskId,
    completedCount,
    totalCount,
    failedCount,
    loading,
    error,
    fetchStatus,
    start,
    pause,
    resume,
    cancel,
    handleStatusChange,
    handleTaskPhaseChange,
    clearError,
  } = useOrchestratorStore()

  const [showStartForm, setShowStartForm] = useState(false)
  const [formSprintName, setFormSprintName] = useState('')
  const [formRepoId, setFormRepoId] = useState('')
  const [sprintNames, setSprintNames] = useState<string[]>([])
  const [showCustomSprint, setShowCustomSprint] = useState(false)

  const loadSprintNames = useCallback(async () => {
    try {
      const res = await window.agentHub.tasks.list()
      if (res.success) {
        const names = [...new Set(res.data.flatMap((t) => t.sprintName ? [t.sprintName] : []))].sort()
        setSprintNames(names)
      }
    } catch {
      // ignore
    }
  }, [])

  // Fetch status on mount
  useEffect(() => {
    fetchStatus()
    loadSprintNames()
  }, [fetchStatus, loadSprintNames])

  // Subscribe to push events
  useEffect(() => {
    const unsubStatus = window.agentHub.orchestrator.onStatusChange(handleStatusChange)
    const unsubPhase = window.agentHub.orchestrator.onTaskPhaseChange(handleTaskPhaseChange)
    return () => {
      unsubStatus()
      unsubPhase()
    }
  }, [handleStatusChange, handleTaskPhaseChange])

  // Auto-start: triggered when a sprint JSON with autoConfirm + autoStart is imported
  useEffect(() => {
    return window.agentHub.on.sprintAutoStart(async (payload) => {
      await start({
        sprintName: payload.sprintName,
        repoId: payload.repoId,
        projectId: selectedProjectId ?? undefined,
        confirmed: true,
      })
    })
  }, [start, selectedProjectId])

  // Re-fetch counts when status changes to keep progress in sync (including terminal states)
  useEffect(() => {
    if (runStatus === 'running' || runStatus === 'paused' || runStatus === 'completed' || runStatus === 'failed') {
      fetchStatus()
    }
  }, [runStatus, fetchStatus])

  async function handleStart() {
    if (!formSprintName.trim() || !formRepoId) return
    const ok = await start({
      sprintName: formSprintName.trim(),
      repoId: formRepoId,
      projectId: selectedProjectId ?? undefined,
      confirmed: true,
    })
    if (ok) {
      setShowStartForm(false)
      setShowCustomSprint(false)
      setFormSprintName('')
      setFormRepoId('')
    }
  }

  const isIdle = !runStatus || runStatus === 'idle' || runStatus === 'completed' || runStatus === 'failed'
  const isRunning = runStatus === 'running'
  const isPaused = runStatus === 'paused'

  return (
    <div className="flex items-center gap-2">
      {/* Status badge */}
      {runStatus && (
        <span className={`badge badge-sm ${STATUS_BADGE[runStatus]}`}>
          {runStatus}
        </span>
      )}

      {/* Sprint name + progress when active */}
      {runId && sprintName && !isIdle && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-base-content/70 max-w-[120px] truncate" title={sprintName}>
            {sprintName}
          </span>
          <span className="text-[10px] text-base-content/70">
            {completedCount}/{totalCount}
          </span>
          {failedCount > 0 && (
            <span className="badge badge-xs badge-error">{failedCount}</span>
          )}
        </div>
      )}

      {/* Start button / inline form */}
      {isIdle && !showStartForm && (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => { setShowStartForm(true); setShowCustomSprint(false); setFormSprintName('') }}
          title="Start orchestrator run"
          disabled={loading}
        >
          <Play size={14} />
        </button>
      )}

      {isIdle && showStartForm && (
        <div className="flex items-center gap-1.5">
          {showCustomSprint ? (
            <input
              type="text"
              className="input input-sm input-bordered w-28"
              placeholder="Sprint name"
              value={formSprintName}
              onChange={(e) => setFormSprintName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setShowCustomSprint(false); setFormSprintName('') } }}
              autoFocus
            />
          ) : (
            <select
              className="select select-sm select-bordered w-28"
              value={formSprintName}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setShowCustomSprint(true)
                  setFormSprintName('')
                } else {
                  setFormSprintName(e.target.value)
                }
              }}
            >
              <option value="">Sprint</option>
              {sprintNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value="__custom__">Other…</option>
            </select>
          )}
          <select
            className="select select-sm select-bordered w-28"
            value={formRepoId}
            onChange={(e) => setFormRepoId(e.target.value)}
          >
            <option value="">Repo</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            className="btn btn-sm btn-success"
            onClick={handleStart}
            disabled={loading || !formSprintName.trim() || !formRepoId}
            title="Start run"
          >
            <Play size={12} />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => { setShowStartForm(false); setShowCustomSprint(false); setFormSprintName(''); setFormRepoId('') }}
            title="Cancel"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      )}

      {/* Pause / Resume toggle */}
      {isRunning && (
        <button
          className="btn btn-sm btn-warning"
          onClick={pause}
          disabled={loading}
          title="Pause orchestrator"
        >
          <Pause size={14} />
        </button>
      )}

      {isPaused && (
        <button
          className="btn btn-sm btn-success"
          onClick={resume}
          disabled={loading}
          title="Resume orchestrator"
        >
          <Play size={14} />
        </button>
      )}

      {/* Cancel button — available for all active runs */}
      {(isRunning || isPaused) && (
        <button
          className="btn btn-sm btn-error btn-outline"
          onClick={cancel}
          disabled={loading}
          title={singleTaskId ? 'Cancel single-task pipeline' : 'Cancel sprint run'}
        >
          <X size={14} />
        </button>
      )}

      {/* Error tooltip */}
      {error && (
        <div className="tooltip tooltip-bottom" data-tip={error}>
          <span
            className="badge badge-xs badge-error cursor-pointer"
            onClick={clearError}
          >
            err
          </span>
        </div>
      )}
    </div>
  )
}
