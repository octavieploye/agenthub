import { useEffect } from 'react'
import { useViewStore } from '@renderer/stores/view-store'
import {
  DECISION_STATUS_LABELS,
  type DecisionItem,
  type DecisionsResult,
  type ProjectStatusItem
} from '../../../../shared/types/decisions.types'
import { useDecisionsStore } from './decisions-store'

const STATE_MESSAGES: Record<Exclude<DecisionsResult['state'], 'ok'>, string> = {
  standalone: 'Running standalone — shared decisions are not connected.',
  maintenance: 'Anamnesis in maintenance — decisions will return when it is back.',
  unauthorized: 'Not authorized to read shared decisions from Anamnesis.',
  unavailable: 'Decisions are unavailable right now. Anamnesis could not be reached.'
}

function groupByDomain(decisions: DecisionItem[]): [string, DecisionItem[]][] {
  const groups = new Map<string, DecisionItem[]>()
  for (const decision of decisions) {
    const group = groups.get(decision.domain)
    if (group) group.push(decision)
    else groups.set(decision.domain, [decision])
  }
  return [...groups.entries()]
}

function DecisionRow({ decision }: { decision: DecisionItem }): React.JSX.Element {
  return (
    <li className="flex flex-col gap-1 rounded-lg bg-base-200 p-3" data-testid="decision-row">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{decision.title}</span>
        <span className="badge badge-outline badge-sm shrink-0">
          {DECISION_STATUS_LABELS[decision.status] ?? decision.status}
        </span>
      </div>
      {decision.summary && <p className="text-xs text-base-content/60">{decision.summary}</p>}
    </li>
  )
}

function StatusRow({ item }: { item: ProjectStatusItem }): React.JSX.Element {
  return (
    <li className="flex flex-col gap-1 rounded-lg bg-base-200 p-3" data-testid="status-row">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium capitalize">{item.domain}</span>
        <span className="badge badge-ghost badge-sm shrink-0">{item.state}</span>
      </div>
      {item.summary && <p className="text-xs text-base-content/60">{item.summary}</p>}
    </li>
  )
}

function OkContent({
  decisions,
  statuses
}: {
  decisions: DecisionItem[]
  statuses: ProjectStatusItem[]
}): React.JSX.Element {
  return (
    <>
      {decisions.length === 0 ? (
        <p className="text-sm text-base-content/50">No decisions recorded for this repo yet.</p>
      ) : (
        groupByDomain(decisions).map(([domain, items]) => (
          <section key={domain} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
              {domain}
            </h3>
            <ul className="flex flex-col gap-2">
              {items.map((decision) => (
                <DecisionRow key={decision.id} decision={decision} />
              ))}
            </ul>
          </section>
        ))
      )}
      {statuses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Project status
          </h3>
          <ul className="flex flex-col gap-2">
            {statuses.map((item) => (
              <StatusRow key={`${item.project_id}-${item.domain}`} item={item} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

export default function DecisionsPanel(): React.JSX.Element {
  const selectedRepoId = useViewStore((s) => s.selectedRepoId)
  const result = useDecisionsStore((s) => s.result)
  const loading = useDecisionsStore((s) => s.loading)
  const refresh = useDecisionsStore((s) => s.refresh)
  const reset = useDecisionsStore((s) => s.reset)

  useEffect(() => reset, [reset])

  useEffect(() => {
    // Drop the previous repo's rows before the new request so they never show under the new repo.
    reset()
    if (selectedRepoId) void refresh(selectedRepoId)
  }, [selectedRepoId, refresh, reset])

  return (
    <div data-testid="decisions-panel" className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Decisions</h2>
        <button
          className="btn btn-ghost btn-sm"
          disabled={loading || !selectedRepoId}
          onClick={() => selectedRepoId && void refresh(selectedRepoId)}
        >
          Refresh
        </button>
      </div>
      {!selectedRepoId ? (
        <p className="text-sm text-base-content/50" data-testid="decisions-no-repo">
          Select a repository to see its shared decisions.
        </p>
      ) : result === null ? (
        <p className="text-sm text-base-content/50">Loading decisions…</p>
      ) : result.state === 'ok' ? (
        <OkContent decisions={result.decisions} statuses={result.statuses} />
      ) : (
        <div className="alert alert-warning py-2 text-sm">
          <span>{STATE_MESSAGES[result.state]}</span>
        </div>
      )}
    </div>
  )
}
