import type { ModelProvider } from '@shared/types/agent.types'
import type { ModelCategory } from '@shared/types/model.types'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@shared/constants/model-catalog'

export interface ModelInfo {
  id: string
  name: string
  provider: ModelProvider
  category?: ModelCategory
  available: boolean
  contextWindow: number
  unavailableReason?: string
  supportsEffort?: boolean
}

export interface ModelPoolProps {
  models: ModelInfo[]
  quotaPercent: number
  planLabel: string
  selectedModelId?: string
  onSelectModel: (modelId: string) => void
  groupByCategory?: boolean
}

function formatContextWindow(tokens: number): string {
  return `${Math.round(tokens / 1000)}k`
}

function CategoryBadge({ category }: { category?: ModelCategory }): React.JSX.Element | null {
  if (!category) return null
  return (
    <span
      data-testid="category-badge"
      className={`text-[10px] px-1.5 py-0.5 rounded-full bg-base-content/5 ${CATEGORY_COLORS[category] ?? ''}`}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  )
}

function ModelRow({
  model,
  isSelected,
  onSelect
}: {
  model: ModelInfo
  isSelected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <div
      key={model.id}
      data-testid={`model-row-${model.id}`}
      onClick={() => model.available && onSelect()}
      className={`flex items-center justify-between p-2 rounded-lg text-sm ${
        isSelected
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
        <CategoryBadge category={model.category} />
      </div>
      <div className="flex items-center gap-2 text-xs text-base-content/50">
        <span>{formatContextWindow(model.contextWindow)}</span>
        {!model.available && model.unavailableReason && (
          <span className="text-error/60">{model.unavailableReason}</span>
        )}
      </div>
    </div>
  )
}

function ModelPool({
  models,
  quotaPercent,
  planLabel,
  selectedModelId,
  onSelectModel,
  groupByCategory = false
}: ModelPoolProps): React.JSX.Element {
  if (!groupByCategory) {
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
              <ModelRow
                key={model.id}
                model={model}
                isSelected={model.id === selectedModelId}
                onSelect={() => onSelectModel(model.id)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const grouped: Record<string, ModelInfo[]> = {}
  for (const model of models) {
    const cat = model.category ?? 'mixed'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(model)
  }
  const categoryOrder: ModelCategory[] = ['thinking', 'coding', 'mixed']

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
        <div className="flex flex-col gap-3">
          {categoryOrder.map((cat) => {
            const catModels = grouped[cat]
            if (!catModels || catModels.length === 0) return null
            return (
              <div key={cat}>
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${CATEGORY_COLORS[cat]}`}>
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="flex flex-col gap-1">
                  {catModels.map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      isSelected={model.id === selectedModelId}
                      onSelect={() => onSelectModel(model.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ModelPool
