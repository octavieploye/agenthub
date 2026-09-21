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
  queued: 'badge-ghost',
  running: 'badge-success',
  paused: 'badge-warning',
  completed: 'badge-info',
  failed: 'badge-error',
  cancelled: 'badge-ghost',
}

export function OrchestratorControls({ repos, selectedProjectId }: OrchestratorControlsProps) {
  const {
    runStatus,
    activeRuns,
    completedCount,
    totalCount,
    failedCount,
    queuedRuns,
    loading,
    error,
    fetchStatus,
    start,
    pause,
    resume,
    cancel,
    handleStatusChange,
    handleTaskPhaseChange,
    handleApprovalNeeded,
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
    const unsubApproval = window.agentHub.orchestrator.onTaskApprovalNeeded(
      (payload) => handleApprovalNeeded(payload)
    )
    return () => {
      unsubStatus()
      unsubPhase()
      unsubApproval()
    }
  }, [handleStatusChange, handleTaskPhaseChange, handleApprovalNeeded])

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
    if (runStatus === 'running' || runStatus === 'paused' || runStatus === 'completed' || runStatus === 'failed' || runStatus === 'cancelled') {
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

  // Preserve existing isIdle logic exactly — used to gate the start button.
  const isIdle = !runStatus || runStatus === 'idle' || runStatus === 'completed' || runStatus === 'failed' || runStatus === 'cancelled'
  const isTerminal = runStatus === 'completed' || runStatus === 'failed' || runStatus === 'cancelled'

  return (
    <div className="flex items-center gap-2">
      {/* Per-run controls for each active run (running | paused) */}
      {activeRuns.map((run) => (
        <div key={run.id} className="flex items-center gap-1.5">
          <span className={`badge badge-sm ${STATUS_BADGE[run.status]}`}>
            {run.status}
          </span>
          <span className="text-[10px] text-base-content/70 max-w-[120px] truncate" title={run.sprintName}>
            {run.sprintName}
          </span>
          {run.status === 'running' && (
            <button
              data-testid={`pause-run-${run.id}`}
              className="btn btn-sm btn-warning"
              onClick={() => pause(run.id)}
              disabled={loading}
              title="Pause orchestrator"
            >
              <Pause size={14} />
            </button>
          )}
          {run.status === 'paused' && (
            <button
              data-testid={`resume-run-${run.id}`}
              className="btn btn-sm btn-success"
              onClick={() => resume(run.id)}
              disabled={loading}
              title="Resume orchestrator"
            >
              <Play size={14} />
            </button>
          )}
          <button
            data-testid={`cancel-run-${run.id}`}
            className="btn btn-sm btn-error btn-outline"
            onClick={() => cancel(run.id)}
            disabled={loading}
            title={run.singleTaskId ? 'Cancel single-task pipeline' : 'Cancel sprint run'}
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Terminal badge — shown whenever singleton reached a terminal state */}
      {isTerminal && runStatus && (
        <span className={`badge badge-sm ${STATUS_BADGE[runStatus]}`}>
          {runStatus}
        </span>
      )}

      {/* Global progress counters — rendered once, not per-run (backend provides no per-run counts) */}
      {totalCount > 0 && !isIdle && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-base-content/70">
            {completedCount}/{totalCount}
          </span>
          {failedCount > 0 && (
            <span className="badge badge-xs badge-error">{failedCount}</span>
          )}
        </div>
      )}

      {/* Start button — only when no active runs and singleton is idle/terminal */}
      {activeRuns.length === 0 && isIdle && !showStartForm && (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => { setShowStartForm(true); setShowCustomSprint(false); setFormSprintName('') }}
          title="Start orchestrator run"
          disabled={loading}
        >
          <Play size={14} />
        </button>
      )}

      {/* Inline start form — same gate as the start button */}
      {activeRuns.length === 0 && isIdle && showStartForm && (
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

      {/* Queued runs indicator + list — unchanged */}
      {queuedRuns.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span data-testid="queue-indicator" className="badge badge-sm badge-ghost">
            {queuedRuns.length} queued
          </span>
          {queuedRuns.map((qr) => (
            <div key={qr.id} className="flex items-center gap-0.5">
              <span className="text-[10px] text-base-content/60 max-w-[100px] truncate" title={qr.sprintName}>
                {qr.sprintName}
              </span>
              <button
                data-testid={`cancel-queued-${qr.id}`}
                className="btn btn-xs btn-ghost text-error"
                onClick={() => cancel(qr.id)}
                disabled={loading}
                title={`Cancel queued run: ${qr.sprintName}`}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
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
