import { useState, useCallback, useEffect, useRef } from 'react'

interface PreLaunchCardProps {
  repoId: string
  repoName: string
  initialTask?: string
  recommendedModel: string
  modelRationale: string
  quotaUsed: number
  quotaLimit: number
  quotaPercent: number
  burnRate: number
  estimatedImpact: number
  guardrails?: {
    maxDuration?: number
    maxFiles?: number
    protectedPaths?: string[]
  }
  onLaunch: (task: string) => void
  onChangeModel: () => void
  onCancel: () => void
}

function PreLaunchCard({
  repoName,
  initialTask,
  recommendedModel,
  modelRationale,
  quotaUsed,
  quotaLimit,
  quotaPercent,
  burnRate,
  estimatedImpact,
  guardrails,
  onLaunch,
  onChangeModel,
  onCancel
}: PreLaunchCardProps): React.JSX.Element {
  const [task, setTask] = useState(initialTask ?? '')
  const cardRef = useRef<HTMLDivElement>(null)

  const handleLaunch = useCallback(() => {
    if (task.trim()) onLaunch(task)
  }, [task, onLaunch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        handleLaunch()
      }
    },
    [onCancel, handleLaunch]
  )

  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  return (
    <div
      ref={cardRef}
      data-testid="pre-launch-card"
      role="dialog"
      aria-label="Pre-launch configuration for new agent"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="panel-glass p-5 w-full max-w-lg animate-slide-down rounded-xl"
    >
      <h2 className="text-sm font-bold tracking-wide text-base-content/70 mb-3">
        PRE-LAUNCH: New Agent
      </h2>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base-content/50">Repo:</span>
          <span className="font-medium">{repoName}</span>
        </div>

        <div>
          <label className="text-xs text-base-content/50 mb-1 block">Task</label>
          <input
            data-testid="pre-launch-task-input"
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe the task..."
            className="input input-bordered w-full rounded-xl bg-base-200/50 text-sm"
          />
        </div>

        <div className="panel-glass p-3 rounded-lg">
          <span className="text-xs font-bold tracking-wide text-base-content/60 block mb-1">
            RECOMMENDED MODEL
          </span>
          <div className="text-sm font-medium">{recommendedModel}</div>
          <div className="text-xs text-base-content/50 mt-1">{modelRationale}</div>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <div>
            <span className="text-base-content/50">Quota: </span>
            <span>
              {quotaUsed}/{quotaLimit} messages ({quotaPercent}%)
            </span>
          </div>
          <div>
            <span className="text-base-content/50">Burn rate: </span>
            <span>{burnRate} msg/hr</span>
          </div>
          <div>
            <span className="text-base-content/50">Est. impact: </span>
            <span>~{estimatedImpact} messages</span>
          </div>
        </div>

        {guardrails && (
          <div data-testid="pre-launch-guardrails" className="panel-glass p-3 rounded-lg text-xs">
            <span className="font-bold tracking-wide text-base-content/60 block mb-1">
              GUARDRAILS
            </span>
            <div className="flex gap-4">
              {guardrails.maxDuration != null && (
                <span>Max duration: {guardrails.maxDuration}min</span>
              )}
              {guardrails.maxFiles != null && <span>Max files: {guardrails.maxFiles}</span>}
            </div>
            {guardrails.protectedPaths && guardrails.protectedPaths.length > 0 && (
              <div className="mt-1 text-base-content/50">
                Protected: {guardrails.protectedPaths.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4 justify-end items-center">
        <button
          data-testid="pre-launch-btn-cancel"
          onClick={onCancel}
          className="btn btn-sm btn-ghost rounded-full text-base-content/60"
        >
          Cancel
        </button>
        <button
          data-testid="pre-launch-btn-change-model"
          onClick={onChangeModel}
          className="btn btn-sm btn-outline btn-secondary rounded-full"
        >
          Change Model
        </button>
        <button
          data-testid="pre-launch-btn-launch"
          onClick={handleLaunch}
          disabled={!task.trim()}
          className="btn-lcars btn-primary"
        >
          Launch
        </button>
      </div>
    </div>
  )
}

export default PreLaunchCard
