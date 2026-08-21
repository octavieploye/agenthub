import type { LayerDistribution } from '@shared/types/lifecycle.types'

interface LayerCardProps {
  layer: LayerDistribution
}

const LAYER_COLORS: Record<string, string> = {
  episodic:      'border-l-info',
  semantic:      'border-l-primary',
  procedural:    'border-l-secondary',
  constellation: 'border-l-accent',
  ethical:       'border-l-warning',
  shadow:        'border-l-error',
  intelligence:  'border-l-success',
}

export default function LayerCard({ layer }: LayerCardProps) {
  const borderColor = LAYER_COLORS[layer.layer] ?? 'border-l-base-content/20'
  const archiveRatio =
    layer.total_records > 0
      ? Math.round((layer.archived_records / layer.total_records) * 100)
      : 0

  return (
    <div
      data-testid={`layer-card-${layer.layer}`}
      className={`border-l-4 ${borderColor} bg-base-200/50 rounded-r-lg p-3`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold capitalize">{layer.layer}</h4>
        <span className="text-xs text-base-content/50">
          {layer.total_records.toLocaleString()} total
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-base-content/50">Active</div>
          <div className="font-mono font-medium">{layer.active_records.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-base-content/50">Archived</div>
          <div className="font-mono font-medium">{layer.archived_records.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-base-content/50">Archive %</div>
          <div className={`font-mono font-medium ${archiveRatio > 25 ? 'text-error' : archiveRatio > 10 ? 'text-warning' : ''}`}>
            {archiveRatio}%
          </div>
        </div>
      </div>

      {layer.avg_relevance_score != null && (
        <div className="mt-2 text-xs text-base-content/50">
          Avg relevance: {layer.avg_relevance_score.toFixed(3)}
        </div>
      )}
    </div>
  )
}
