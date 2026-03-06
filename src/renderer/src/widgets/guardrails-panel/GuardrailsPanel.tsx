import { useState } from 'react'
import type { GuardrailConfig } from '@shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '@shared/types/config.types'

interface GuardrailsPanelProps {
  repoId: string
  repoName: string
  repoPath: string
  config: GuardrailConfig
  onUpdate: (key: keyof GuardrailConfig, value: unknown) => void
  onReset: () => void
  onClose: () => void
}

interface SliderDef {
  key: keyof GuardrailConfig
  label: string
  min: number
  max: number
  step: number
}

const SLIDERS: SliderDef[] = [
  { key: 'maxDurationMinutes', label: 'Max Duration (min)', min: 5, max: 480, step: 5 },
  { key: 'maxFilesChanged', label: 'Max Files Changed', min: 1, max: 200, step: 1 },
  { key: 'maxConsecutiveErrors', label: 'Max Consecutive Errors', min: 1, max: 50, step: 1 },
  { key: 'maxTokensPerSession', label: 'Max Tokens / Session', min: 1000, max: 1000000, step: 1000 }
]

function isDefaultConfig(config: GuardrailConfig): boolean {
  return (
    config.maxDurationMinutes === DEFAULT_GUARDRAILS.maxDurationMinutes &&
    config.maxFilesChanged === DEFAULT_GUARDRAILS.maxFilesChanged &&
    config.maxConsecutiveErrors === DEFAULT_GUARDRAILS.maxConsecutiveErrors &&
    config.maxTokensPerSession === DEFAULT_GUARDRAILS.maxTokensPerSession &&
    config.protectedPaths.length === DEFAULT_GUARDRAILS.protectedPaths.length &&
    config.protectedPaths.every((p, i) => p === DEFAULT_GUARDRAILS.protectedPaths[i])
  )
}

export default function GuardrailsPanel({
  repoName,
  config,
  onUpdate,
  onReset,
  onClose
}: GuardrailsPanelProps): React.JSX.Element {
  const [newPath, setNewPath] = useState('')

  function handleSliderChange(key: keyof GuardrailConfig, rawValue: string): void {
    onUpdate(key, Number(rawValue))
  }

  function handleAddPath(): void {
    const trimmed = newPath.trim()
    if (!trimmed) return
    onUpdate('protectedPaths', [...config.protectedPaths, trimmed])
    setNewPath('')
  }

  function handleRemovePath(index: number): void {
    const updated = config.protectedPaths.filter((_, i) => i !== index)
    onUpdate('protectedPaths', updated)
  }

  return (
    <section role="region" aria-label="Guardrails Configuration" className="panel-glass p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          <span>{repoName}</span> <span className="text-base-content/60">guardrails</span>
        </h3>
        <div className="flex items-center gap-2">
          {isDefaultConfig(config) && (
            <span className="badge badge-ghost badge-sm">Default</span>
          )}
          <button
            data-testid="guardrail-btn-close"
            onClick={onClose}
            className="btn btn-ghost btn-xs"
            aria-label="Close guardrails panel"
          >
            ✕
          </button>
        </div>
      </div>

      {SLIDERS.map((slider) => (
        <div key={slider.key} className="form-control">
          <label className="label">
            <span className="label-text">{slider.label}</span>
            <span className="label-text-alt">{config[slider.key] as number}</span>
          </label>
          <input
            type="range"
            data-testid={`guardrail-slider-${slider.key}`}
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={config[slider.key] as number}
            onChange={(e) => handleSliderChange(slider.key, e.target.value)}
            className="range range-xs"
          />
        </div>
      ))}

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Protected Paths</h4>
        {config.protectedPaths.map((path, i) => (
          <div key={`${path}-${i}`} className="flex items-center gap-2">
            <span className="text-sm flex-1">{path}</span>
            <button
              data-testid={`guardrail-remove-path-${i}`}
              onClick={() => handleRemovePath(i)}
              className="btn btn-ghost btn-xs"
              aria-label={`Remove ${path}`}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            data-testid="guardrail-add-path-input"
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
            placeholder="Add protected path..."
            className="input input-bordered input-xs flex-1"
          />
        </div>
      </div>

      <button
        data-testid="guardrail-btn-reset"
        data-confirm="true"
        onClick={onReset}
        className="btn btn-warning btn-xs"
      >
        Reset All
      </button>
    </section>
  )
}
