import { useState } from 'react'
import type { BugEntry, BugSeverity } from '@shared/types/bug-radar.types'

interface BugRadarProps {
  bugs: BugEntry[]
  repos: { id: string; name: string }[]
  onNavigateToAgent: (agentId: string) => void
  onResolveBug: (bugId: string) => void
}

const SEVERITY_COLORS: Record<BugSeverity, string> = {
  low: 'badge-info',
  medium: 'badge-warning',
  high: 'badge-accent',
  critical: 'badge-error'
}

function groupByRepo(bugs: BugEntry[]): Map<string, BugEntry[]> {
  const groups = new Map<string, BugEntry[]>()
  for (const bug of bugs) {
    const existing = groups.get(bug.repoName) ?? []
    existing.push(bug)
    groups.set(bug.repoName, existing)
  }
  return groups
}

export default function BugRadar({
  bugs,
  repos,
  onNavigateToAgent,
  onResolveBug
}: BugRadarProps): React.JSX.Element {
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [repoFilter, setRepoFilter] = useState<string>('all')

  const filteredBugs = bugs.filter((bug) => {
    if (severityFilter !== 'all' && bug.severity !== severityFilter) return false
    if (repoFilter !== 'all' && bug.repoId !== repoFilter) return false
    return true
  })

  const grouped = groupByRepo(filteredBugs)

  return (
    <section role="region" aria-label="Bug Radar" className="panel-glass p-4 space-y-3">
      <h3 className="text-lg font-semibold">Bug Radar</h3>

      <div className="flex gap-2">
        <select
          data-testid="severity-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="select select-bordered select-xs"
        >
          <option value="all">All Severities</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>

        <select
          data-testid="repo-filter"
          value={repoFilter}
          onChange={(e) => setRepoFilter(e.target.value)}
          className="select select-bordered select-xs"
          aria-label="Filter by repository"
        >
          <option value="all">All Repos</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              <span>{repo.name.slice(0, 1)}</span>
              <span>{repo.name.slice(1)}</span>
            </option>
          ))}
        </select>
      </div>

      {filteredBugs.length === 0 ? (
        <div data-testid="bug-radar-empty" className="text-center py-4 opacity-50">
          No bugs tracked
        </div>
      ) : (
        [...grouped.entries()].map(([repoName, repoBugs]) => (
          <div key={repoName} className="space-y-1">
            <h4 data-testid={`repo-group-${repoName}`} className="text-sm font-medium opacity-70">{repoName}</h4>
            {repoBugs.map((bug) => (
              <div
                key={bug.id}
                data-testid={`bug-entry-${bug.id}`}
                onClick={() => onNavigateToAgent(bug.agentId)}
                className="border border-base-300 rounded p-2 cursor-pointer hover:bg-base-200 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{bug.agentName}</span>
                    <span className="text-xs opacity-60">{bug.errorType}</span>
                    <span
                      data-testid={`severity-badge-${bug.id}`}
                      className={`badge badge-xs ${SEVERITY_COLORS[bug.severity]}`}
                    >
                      {bug.severity}
                    </span>
                  </div>
                  <button
                    data-testid={`resolve-bug-${bug.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onResolveBug(bug.id)
                    }}
                    className="btn btn-ghost btn-xs"
                  >
                    ✓
                  </button>
                </div>
                <div className="text-xs font-mono opacity-60">{bug.filePath}</div>
                <div className="text-xs opacity-50">{bug.message}</div>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  )
}
