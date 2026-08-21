import type { LifecycleHistoryEntry } from '@shared/types/lifecycle.types'

interface ConsolidationSummaryProps {
  history: LifecycleHistoryEntry[]
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function ConsolidationSummary({ history }: ConsolidationSummaryProps) {
  if (history.length === 0) {
    return (
      <div className="text-sm text-base-content/40 py-4 text-center">
        No consolidation runs recorded yet
      </div>
    )
  }

  return (
    <div data-testid="consolidation-summary" className="space-y-1">
      <h3 className="text-sm font-semibold mb-2">Recent Consolidation Runs</h3>
      <div className="overflow-x-auto">
        <table className="table table-xs w-full">
          <thead>
            <tr className="text-base-content/50">
              <th>Status</th>
              <th>Started</th>
              <th>Archived</th>
              <th>Promoted</th>
              <th>Decayed</th>
            </tr>
          </thead>
          <tbody>
            {history.map((run) => (
              <tr key={run.id} className="hover:bg-base-200/30">
                <td>
                  <span className={`badge badge-xs ${
                    run.status === 'done' ? 'badge-success' :
                    run.status === 'failed' ? 'badge-error' :
                    'badge-warning'
                  }`}>
                    {run.status}
                  </span>
                </td>
                <td className="font-mono text-[10px]">{formatDate(run.started_at)}</td>
                <td className="font-mono">{run.records_archived}</td>
                <td className="font-mono">{run.patterns_promoted}</td>
                <td className="font-mono">{run.records_decayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
