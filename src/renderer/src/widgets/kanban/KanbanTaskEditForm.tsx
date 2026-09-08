import type { TaskPriority, TaskStatus } from '@shared/types/task.types'
import { CLOUD_MODEL_OPTIONS, ANTHROPIC_MODEL_OPTIONS, CODEX_MODEL_OPTIONS } from '@shared/constants/cloud-models'
import type { ValidProvider } from '@shared/constants/cloud-models'

interface KanbanTaskEditFormProps {
  sectionTargetDate: string
  onSectionTargetDateChange: (v: string) => void
  modelOverride: string
  providerOverride: string
  onModelProviderChange: (model: string, provider: string) => void
  requiresApproval: boolean
  onRequiresApprovalChange: (v: boolean) => void
  dateTriggerFiredAt: string | null
  codexAvailable: boolean
  /** Pre-expanded when any scheduling field is set */
  defaultOpen: boolean
}

export function KanbanTaskEditForm({
  sectionTargetDate,
  onSectionTargetDateChange,
  modelOverride,
  providerOverride,
  onModelProviderChange,
  requiresApproval,
  onRequiresApprovalChange,
  dateTriggerFiredAt,
  codexAvailable,
  defaultOpen,
}: KanbanTaskEditFormProps) {
  return (
    <details className="collapse collapse-arrow bg-base-300/30 rounded-lg" open={defaultOpen}>
      <summary className="collapse-title text-xs text-base-content/50 font-medium uppercase tracking-wide min-h-0 py-2 px-3">
        Scheduling
      </summary>
      <div className="collapse-content flex flex-col gap-2 px-3 pb-2">
        {/* Target Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-base-content/50">Target Date</label>
          <input
            type="date"
            className="input input-xs input-bordered w-full"
            value={sectionTargetDate}
            onChange={(e) => onSectionTargetDateChange(e.target.value)}
          />
        </div>

        {/* Model / Provider */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-base-content/50">Model Override</label>
          <select
            className="select select-xs select-bordered w-full"
            value={modelOverride ? `${providerOverride}::${modelOverride}` : ''}
            onChange={(e) => {
              const val = e.target.value
              if (!val) {
                onModelProviderChange('', '')
              } else {
                const [prov, ...modelParts] = val.split('::')
                onModelProviderChange(modelParts.join('::'), prov as ValidProvider)
              }
            }}
          >
            <option value="">Auto (recommended)</option>
            <optgroup label="Ollama Cloud">
              {CLOUD_MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={`${m.provider}::${m.id}`}>{m.name}</option>
              ))}
            </optgroup>
            <optgroup label="Anthropic">
              {ANTHROPIC_MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={`${m.provider}::${m.id}`}>{m.name}</option>
              ))}
            </optgroup>
            {codexAvailable && (
              <optgroup label="Codex">
                {CODEX_MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={`${m.provider}::${m.id}`}>{m.name}</option>
                ))}
              </optgroup>
            )}
            <option value="ollama-local::">Ollama Local (auto-detect)</option>
          </select>
        </div>

        {/* Requires Approval */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-xs toggle-primary"
            checked={requiresApproval}
            onChange={(e) => onRequiresApprovalChange(e.target.checked)}
          />
          <span className="text-xs text-base-content/70">Requires approval</span>
        </label>

        {/* Date Trigger Fired At */}
        {dateTriggerFiredAt && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/50">Trigger Fired</label>
            <div className="text-xs text-base-content/70 px-2 py-1 bg-base-200/50 rounded">
              {new Date(dateTriggerFiredAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
