import { useEffect } from 'react'
import { useLifecycleStore } from '@renderer/stores/lifecycle-store'
import HealthBadge from './HealthBadge'
import LayerCard from './LayerCard'
import ConsolidationSummary from './ConsolidationSummary'
import ArchiveBrowser from './ArchiveBrowser'
import MemoryRefreshButton from './MemoryRefreshButton'

export default function MemoryHealthPanel() {
  const metrics = useLifecycleStore((s) => s.metrics)
  const distribution = useLifecycleStore((s) => s.distribution)
  const history = useLifecycleStore((s) => s.history)
  const error = useLifecycleStore((s) => s.error)
  const hasFetchedOnce = useLifecycleStore((s) => s.hasFetchedOnce)
  const fetchAll = useLifecycleStore((s) => s.fetchAll)
  const runCycle = useLifecycleStore((s) => s.runCycle)
  const loading = useLifecycleStore((s) => s.loading)

  useEffect(() => {
    if (!hasFetchedOnce) {
      fetchAll()
    }
  }, [hasFetchedOnce, fetchAll])

  return (
    <div
      data-testid="memory-health-panel"
      className="flex flex-col h-full overflow-y-auto p-4 gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Memory Health</h2>
          {metrics && <HealthBadge status={metrics.health_status} />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runCycle()}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Trigger manual lifecycle cycle"
          >
            Run Cycle
          </button>
          <MemoryRefreshButton />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="alert alert-warning py-2 text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Metrics overview */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total Records" value={metrics.total_records} />
          <MetricCard label="Active" value={metrics.active_records} />
          <MetricCard label="Archived" value={metrics.archived_records} />
          <MetricCard
            label="Last Cycle"
            value={metrics.last_cycle_at ? formatRelative(metrics.last_cycle_at) : 'Never'}
            mono={false}
          />
        </div>
      )}

      {/* Layer distribution */}
      {distribution.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Layer Distribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {distribution.map((layer) => (
              <LayerCard key={layer.layer} layer={layer} />
            ))}
          </div>
        </div>
      )}

      {/* Consolidation history */}
      <ConsolidationSummary history={history} />

      {/* Archive browser */}
      <ArchiveBrowser />

      {/* Empty state */}
      {!hasFetchedOnce && !loading && (
        <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">
          Loading memory health data...
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  mono = true,
}: {
  label: string
  value: number | string
  mono?: boolean
}) {
  return (
    <div className="bg-base-200/50 rounded-lg p-3">
      <div className="text-xs text-base-content/50 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${mono ? 'font-mono' : ''}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    return `${diffD}d ago`
  } catch {
    return iso
  }
}
