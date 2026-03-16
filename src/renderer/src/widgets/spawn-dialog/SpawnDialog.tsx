import { useState, useEffect, useCallback } from 'react'
import type { RepoConfig } from '@shared/types/config.types'
import type { EffortLevel } from '@shared/types/agent.types'
import type { ModelCatalogEntry } from '@shared/types/model.types'
import { useUsageStore } from '@renderer/stores/usage-store'
import { PLAN_LIMITS } from '@shared/constants/plan-limits'
import { AGENT_COLOR_PALETTE } from '@shared/constants/defaults'
import { CLAUDE_MODELS, EFFORT_LEVELS, EFFORT_LABELS } from '@shared/constants/model-catalog'
import PreLaunchCard from '@renderer/widgets/pre-launch-card/PreLaunchCard'
import ModelPool from '@renderer/widgets/model-pool/ModelPool'
import type { ModelInfo } from '@renderer/widgets/model-pool/ModelPool'

function catalogToModelInfo(entry: ModelCatalogEntry): ModelInfo {
  return {
    id: entry.id,
    name: entry.name,
    provider: entry.provider,
    category: entry.category,
    family: entry.family,
    available: entry.available,
    contextWindow: entry.contextWindow,
    unavailableReason: entry.unavailableReason,
    supportsEffort: entry.supportsEffort
  }
}

interface SpawnDialogProps {
  open: boolean
  onClose: () => void
  onSpawn: (
    cwd: string,
    name: string,
    repoId: string,
    model?: string,
    task?: string,
    color?: string,
    provider?: string,
    effortLevel?: EffortLevel,
    skipPermissions?: boolean
  ) => void
}

type Step = 'configure' | 'pre-launch' | 'model-select'

function SpawnDialog({ open, onClose, onSpawn }: SpawnDialogProps): React.JSX.Element | null {
  const [repos, setRepos] = useState<RepoConfig[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [customCwd, setCustomCwd] = useState('')
  const [agentName, setAgentName] = useState('')
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoPath, setNewRepoPath] = useState('')
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [step, setStep] = useState<Step>('configure')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6')
  const [selectedColor, setSelectedColor] = useState(AGENT_COLOR_PALETTE[0])
  const [effortLevel, setEffortLevel] = useState<EffortLevel>('medium')
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(
    CLAUDE_MODELS.map(catalogToModelInfo)
  )
  const [loadingModels, setLoadingModels] = useState(false)
  const [skipPermissions, setSkipPermissions] = useState(false)

  const plan = useUsageStore((s) => s.plan)
  const totalMessages = useUsageStore((s) => s.totalMessages)
  const quotaPercent = useUsageStore((s) => s.quotaPercent)
  const burnRate = useUsageStore((s) => s.burnRate)

  const loadRepos = useCallback(async () => {
    try {
      const response = await window.agentHub.db.getRepos()
      if (response.success) setRepos(response.data)
    } catch {
      // ignore
    }
  }, [])

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const response = await window.agentHub.models.listAll()
      if (response.success && response.data.length > 0) {
        setAvailableModels(response.data.map(catalogToModelInfo))
      }
    } catch {
      // fall back to built-in Claude models
    } finally {
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadRepos()
      loadModels()
      setAgentName('')
      setCustomCwd('')
      setSelectedRepoId('')
      setShowAddRepo(false)
      setStep('configure')
      setSelectedModel('claude-sonnet-4-6')
      setEffortLevel('medium')
      setSelectedColor(AGENT_COLOR_PALETTE[Math.floor(Math.random() * AGENT_COLOR_PALETTE.length)])
    }
  }, [open, loadRepos, loadModels])

  const handleAddRepo = useCallback(async () => {
    if (!newRepoName.trim() || !newRepoPath.trim()) return
    try {
      const response = await window.agentHub.db.addRepo({
        name: newRepoName.trim(),
        path: newRepoPath.trim()
      })
      if (response.success) {
        setSelectedRepoId(response.data.id)
        setNewRepoName('')
        setNewRepoPath('')
        setShowAddRepo(false)
        loadRepos()
      }
    } catch {
      // ignore
    }
  }, [newRepoName, newRepoPath, loadRepos])

  const handleBrowse = useCallback(async () => {
    try {
      const response = await window.agentHub.dialog.openDirectory()
      if (response.success && response.data) {
        setCustomCwd(response.data)
      }
    } catch {
      // ignore
    }
  }, [])

  const selectedRepo = repos.find((r) => r.id === selectedRepoId)
  const resolvedCwd = selectedRepo?.path ?? customCwd.trim()
  const canProceed = !!resolvedCwd

  const handleNext = useCallback(() => {
    if (canProceed) setStep('pre-launch')
  }, [canProceed])

  const handleLaunch = useCallback(
    (task: string) => {
      const name = agentName.trim() || `agent-${Date.now().toString(36).slice(-4)}`
      const repoId = selectedRepoId || 'default'
      const modelInfo = availableModels.find((m) => m.id === selectedModel)
      const provider = modelInfo?.provider ?? 'anthropic'
      onSpawn(resolvedCwd, name, repoId, selectedModel, task, selectedColor, provider, effortLevel, skipPermissions)
      onClose()
    },
    [resolvedCwd, agentName, selectedRepoId, selectedModel, selectedColor, effortLevel, skipPermissions, availableModels, onSpawn, onClose]
  )

  if (!open) return null

  const limits = PLAN_LIMITS[plan]
  const repoName = selectedRepo?.name ?? resolvedCwd.split('/').pop() ?? 'Project'
  const currentModelInfo = availableModels.find((m) => m.id === selectedModel)

  if (step === 'model-select') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Select Model">
        <div className="w-full max-w-md mx-4">
          {loadingModels && (
            <div className="text-center text-xs text-base-content/50 mb-2">Loading models...</div>
          )}
          <ModelPool
            models={availableModels}
            quotaPercent={quotaPercent}
            planLabel={limits?.label ?? 'Pro'}
            selectedModelId={selectedModel}
            onSelectModel={(modelId) => {
              setSelectedModel(modelId)
              setStep('pre-launch')
            }}
          />
          <button
            onClick={() => setStep('pre-launch')}
            className="btn btn-sm btn-ghost rounded-full mt-3 w-full"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  if (step === 'pre-launch') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pre-launch Review">
        <div className="w-full max-w-md mx-4 flex flex-col gap-3">
          <PreLaunchCard
            repoId={selectedRepoId || 'default'}
            repoName={repoName}
            initialTask=""
            recommendedModel={currentModelInfo?.name ?? selectedModel}
            modelRationale={
              selectedModel.includes('opus')
                ? 'Maximum capability for complex tasks'
                : selectedModel.includes('sonnet')
                  ? 'Balanced speed and capability for general tasks'
                  : selectedModel.includes('haiku')
                    ? 'Fast and efficient for routine tasks'
                    : 'Local/cloud model — no Anthropic quota usage'
            }
            quotaUsed={totalMessages}
            quotaLimit={limits?.messageLimit ?? 250}
            quotaPercent={quotaPercent}
            burnRate={burnRate}
            estimatedImpact={selectedModel.includes('opus') ? 25 : selectedModel.includes('haiku') ? 5 : 15}
            onLaunch={handleLaunch}
            onChangeModel={() => setStep('model-select')}
            onCancel={() => setStep('configure')}
          />

          {/* Effort level selector */}
          {currentModelInfo?.supportsEffort !== false && (
            <div className="panel-glass p-3 rounded-lg">
              <span className="text-xs font-bold tracking-wide text-base-content/60 block mb-2">
                REASONING EFFORT
              </span>
              <div className="flex gap-2">
                {EFFORT_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setEffortLevel(level)}
                    className={`flex-1 text-xs py-1.5 px-2 rounded-lg border transition-all ${
                      effortLevel === level
                        ? 'bg-primary/15 border-primary/30 text-primary'
                        : 'border-base-content/10 text-base-content/50 hover:border-base-content/20'
                    }`}
                  >
                    <div className="font-medium capitalize">{level}</div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-base-content/40 mt-1">
                {EFFORT_LABELS[effortLevel]}
              </div>
            </div>
          )}

          {/* Skip permissions toggle */}
          <div className="panel-glass p-3 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold tracking-wide text-base-content/60 block">
                  AUTONOMOUS MODE
                </span>
                <span className="text-[10px] text-base-content/40">
                  Skip permission prompts (--dangerously-skip-permissions)
                </span>
              </div>
              <input
                type="checkbox"
                checked={skipPermissions}
                onChange={(e) => setSkipPermissions(e.target.checked)}
                className="toggle toggle-sm toggle-warning"
              />
            </label>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Launch Agent">
      <div className="panel-glass p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold mb-4">Launch Agent</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-base-content/50 mb-1 block">Agent Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. frontend-refactor"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="input input-bordered w-full rounded-xl bg-base-200/50 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-base-content/50 mb-1 block">Agent Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {AGENT_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  data-testid={`color-swatch-${color}`}
                  onClick={() => setSelectedColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    selectedColor === color
                      ? 'border-base-content scale-110'
                      : 'border-transparent hover:border-base-content/30'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                title="Custom color"
              />
            </div>
          </div>

          {repos.length > 0 && (
            <div>
              <label className="text-xs text-base-content/50 mb-1 block">Select Repository</label>
              <select
                value={selectedRepoId}
                onChange={(e) => {
                  setSelectedRepoId(e.target.value)
                  if (e.target.value) setCustomCwd('')
                }}
                className="select select-bordered w-full rounded-xl bg-base-200/50 text-sm"
              >
                <option value="">-- Custom path --</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.name} — {repo.path}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!selectedRepoId && (
            <div>
              <label className="text-xs text-base-content/50 mb-1 block">Working Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="/Users/you/project"
                  value={customCwd}
                  onChange={(e) => setCustomCwd(e.target.value)}
                  className="input input-bordered flex-1 rounded-xl bg-base-200/50 text-sm"
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="btn btn-sm btn-ghost rounded-xl border border-base-content/10"
                >
                  Browse
                </button>
              </div>
            </div>
          )}

          {!showAddRepo ? (
            <button
              onClick={() => setShowAddRepo(true)}
              className="text-xs text-primary hover:underline self-start"
            >
              + Register new repository
            </button>
          ) : (
            <div className="panel-glass p-3 flex flex-col gap-2">
              <span className="text-xs font-medium text-base-content/60">New Repository</span>
              <input
                type="text"
                placeholder="Repository name"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                className="input input-bordered input-sm w-full rounded-lg bg-base-200/50 text-sm"
              />
              <input
                type="text"
                placeholder="Absolute path"
                value={newRepoPath}
                onChange={(e) => setNewRepoPath(e.target.value)}
                className="input input-bordered input-sm w-full rounded-lg bg-base-200/50 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddRepo}
                  disabled={!newRepoName.trim() || !newRepoPath.trim()}
                  className="btn btn-xs btn-primary rounded-full"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddRepo(false)}
                  className="btn btn-xs btn-ghost rounded-full"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn btn-sm btn-ghost rounded-full" aria-label="Close dialog">
            Cancel
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="btn-lcars btn-primary"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export default SpawnDialog
