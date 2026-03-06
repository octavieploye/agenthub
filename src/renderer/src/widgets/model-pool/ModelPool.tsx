import type { ModelProvider } from '@shared/types/agent.types'

export interface ModelInfo {
  id: string
  name: string
  provider: ModelProvider
  available: boolean
  contextWindow: number
  unavailableReason?: string
}

export interface ModelPoolProps {
  models: ModelInfo[]
  quotaPercent: number
  planLabel: string
  selectedModelId?: string
  onSelectModel: (modelId: string) => void
}

function formatContextWindow(tokens: number): string {
  return `${Math.round(tokens / 1000)}k`
}

function ModelPool({
  models,
  quotaPercent,
  planLabel,
  selectedModelId,
  onSelectModel
}: ModelPoolProps): React.JSX.Element {
  return (
    <div data-testid="model-pool" className="panel-glass p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold tracking-wide">Model Pool</h2>
        <span className="text-xs text-base-content/50">
          {planLabel} — {quotaPercent}%
        </span>
      </div>

      {models.length === 0 ? (
        <div data-testid="model-pool-empty" className="text-sm text-base-content/40 text-center py-4">
          No models available.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {models.map((model) => (
            <div
              key={model.id}
              data-testid={`model-row-${model.id}`}
              onClick={() => model.available && onSelectModel(model.id)}
              className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                model.id === selectedModelId
                  ? 'bg-primary/15 border border-primary/30'
                  : model.available
                    ? 'cursor-pointer hover:bg-base-content/5'
                    : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{model.name}</span>
                <span
                  data-testid="provider-badge"
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-base-content/10"
                >
                  {model.provider}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-base-content/50">
                <span>{formatContextWindow(model.contextWindow)}</span>
                {!model.available && model.unavailableReason && (
                  <span className="text-error/60">{model.unavailableReason}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ModelPool
