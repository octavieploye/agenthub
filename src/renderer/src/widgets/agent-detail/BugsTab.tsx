import { useEffect, useCallback } from 'react'
import { useBugStore } from '../../stores/bug-store'
import type { AgentState } from '@shared/types/agent.types'
import type { BugEntry, BugSeverity } from '@shared/types/bug-radar.types'

interface BugsTabProps {
  agent: AgentState
}

const SEVERITY_BADGE: Record<BugSeverity, string> = {
  critical: 'badge-error',
  high: 'badge-warning',
  medium: 'badge-info',
  low: 'badge-ghost'
}

function sortBugs(bugs: BugEntry[]): BugEntry[] {
  const severityOrder: Record<BugSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  }

  return [...bugs].sort((a, b) => {
    const aResolved = a.resolvedAt ? 1 : 0
    const bResolved = b.resolvedAt ? 1 : 0
    if (aResolved !== bResolved) return aResolved - bResolved
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

function truncatePath(filePath: string, maxLength: number = 50): string {
  if (filePath.length <= maxLength) return filePath
  const parts = filePath.split('/')
  let result = parts[parts.length - 1]
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i] + '/' + result
    if (candidate.length > maxLength) {
      return '.../' + result
    }
    result = candidate
  }
  return result
}

export default function BugsTab({ agent }: BugsTabProps): React.JSX.Element {
  console.log('[DEBUG-RENDER] BugsTab render', performance.now().toFixed(1))
  const bugs = useBugStore((s) => s.bugs)
  const fetchBugsOnce = useBugStore((s) => s.fetchBugsOnce)
  const loading = useBugStore((s) => s.loading)
  const resolveBug = useBugStore((s) => s.resolveBug)
  const deleteBug = useBugStore((s) => s.deleteBug)

  useEffect(() => {
    console.log('[DEBUG-TAB] BugsTab useEffect MOUNT — calling fetchBugsOnce', performance.now().toFixed(1))
    fetchBugsOnce()
  }, [fetchBugsOnce])

  const repoBugs = sortBugs(bugs.filter((b) => b.repoId === agent.repoId))

  const handleResolve = useCallback(
    (id: string) => {
      resolveBug(id)
    },
    [resolveBug]
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteBug(id)
    },
    [deleteBug]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-dots loading-sm text-base-content/40" />
          </div>
        )}

        {!loading && repoBugs.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-base-content/40">No bugs tracked for this repo</p>
          </div>
        )}

        {!loading &&
          repoBugs.map((bug) => (
            <div
              key={bug.id}
              className={`px-3 py-2.5 border-b border-base-content/5 last:border-b-0 space-y-1 hover:bg-base-content/5 transition-colors ${
                bug.resolvedAt ? 'opacity-40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`badge badge-xs ${SEVERITY_BADGE[bug.severity]} shrink-0`}>
                    {bug.severity}
                  </span>
                  <span className="text-xs font-medium text-base-content/70 shrink-0">
                    {bug.errorType}
                  </span>
                  <span className="text-[10px] font-mono text-base-content/40 truncate">
                    {truncatePath(bug.filePath)}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {!bug.resolvedAt && (
                    <button
                      onClick={() => handleResolve(bug.id)}
                      className="btn btn-ghost btn-xs text-success"
                      title="Resolve bug"
                    >
                      Fix
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(bug.id)}
                    className="btn btn-ghost btn-xs text-error/60"
                    title="Delete bug"
                  >
                    Del
                  </button>
                </div>
              </div>

              <p className="text-xs text-base-content/50 truncate">{bug.message}</p>
            </div>
          ))}
      </div>
    </div>
  )
}
