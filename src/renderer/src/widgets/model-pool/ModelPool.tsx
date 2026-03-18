import type { ModelProvider } from '@shared/types/agent.types'
import type { ModelCategory } from '@shared/types/model.types'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@shared/constants/model-catalog'

export interface ModelInfo {
  id: string
  name: string
  provider: ModelProvider
  category?: ModelCategory
  family?: string
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
  onSelectModel
}: ModelPoolProps): React.JSX.Element {
  const cloudModels = models.filter((m) => m.provider === 'ollama-cloud')
  const localModels = models.filter((m) => m.provider === 'ollama-local')
  const claudeModels = models.filter((m) => m.provider === 'anthropic')

  // Group by family helper
  function groupByFamily(list: ModelInfo[]): { families: Record<string, ModelInfo[]>; sorted: string[] } {
    const families: Record<string, ModelInfo[]> = {}
    for (const model of list) {
      const family = model.family ?? 'Other'
      if (!families[family]) families[family] = []
      families[family].push(model)
    }
    const sorted = Object.keys(families).sort((a, b) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
    return { families, sorted }
  }

  const cloudGrouped = groupByFamily(cloudModels)
  const localGrouped = groupByFamily(localModels)

  return (
    <div data-testid="model-pool" className="panel-glass p-4 rounded-xl max-h-[70vh] overflow-y-auto">
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
          {/* OLLAMA CLOUD section */}
          {cloudModels.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-cyan-400">
                OLLAMA CLOUD
              </div>
              <div className="flex flex-col gap-2 ml-1">
                {cloudGrouped.sorted.map((family) => (
                  <div key={family}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-base-content/40 pl-1">
                      {family}
                    </div>
                    <div className="flex flex-col gap-1">
                      {cloudGrouped.families[family].map((model) => (
                        <ModelRow
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModelId}
                          onSelect={() => onSelectModel(model.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OLLAMA LOCAL section */}
          {localModels.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-teal-400">
                OLLAMA LOCAL
              </div>
              <div className="flex flex-col gap-2 ml-1">
                {localGrouped.sorted.map((family) => (
                  <div key={family}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-base-content/40 pl-1">
                      {family}
                    </div>
                    <div className="flex flex-col gap-1">
                      {localGrouped.families[family].map((model) => (
                        <ModelRow
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModelId}
                          onSelect={() => onSelectModel(model.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CLAUDE section */}
          {claudeModels.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-amber-400">
                CLAUDE
              </div>
              <div className="flex flex-col gap-1">
                {claudeModels.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    isSelected={model.id === selectedModelId}
                    onSelect={() => onSelectModel(model.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ModelPool
