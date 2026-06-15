import { useEffect, useState } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import type { SBARHandoff } from '@shared/types/recovery.types'
import { buildContinuationPrompt, stripAnsi, extractTail } from './buildContinuationPrompt'

interface ContinuationDialogProps {
  agent: AgentState
  onClose: () => void
  onSpawn: (cwd: string, name: string, repoId: string, model?: string, task?: string) => Promise<string | null>
}

export function ContinuationDialog({
  agent,
  onClose,
  onSpawn
}: ContinuationDialogProps): React.JSX.Element {
  const [sbar, setSbar] = useState<SBARHandoff | null>(null)
  const [tail, setTail] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [prompt, setPrompt] = useState('')
  const [name, setName] = useState(`${agent.name} (cont.)`)
  const [cwd, setCwd] = useState(agent.cwd ?? '')
  const [model, setModel] = useState(agent.model ?? '')
  const [summaryVisible, setSummaryVisible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [spawning, setSpawning] = useState(false)
  const [spawnError, setSpawnError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      window.agentHub.recovery.getSbar(agent.id),
      window.agentHub.history.get(agent.id)
    ]).then(([sbarRes, histRes]) => {
      if (cancelled) return

      const fetchedSbar = sbarRes.success ? sbarRes.data ?? null : null
      setSbar(fetchedSbar)

      const fullOutput = histRes.success && histRes.data
        ? histRes.data.map((e) => e.content).join('')
        : ''
      const stripped = stripAnsi(fullOutput)
      const fetchedTail = extractTail(stripped, 50)
      setTail(fetchedTail)

      const generated = buildContinuationPrompt(fetchedSbar, fetchedTail)
      setGeneratedPrompt(generated)
      setPrompt(generated)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [agent.id])

  const handleSpawn = async (): Promise<void> => {
    setSpawning(true)
    setSpawnError(null)
    const err = await onSpawn(cwd, name, agent.repoId, model || undefined, prompt)
    if (err) {
      setSpawnError(err)
      setSpawning(false)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel-glass flex flex-col w-full max-w-2xl max-h-[90vh] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/10 shrink-0">
          <span className="text-sm font-semibold text-base-content">Spawn Continuation Agent</span>
          <button className="btn btn-xs btn-ghost text-base-content/60" onClick={onClose}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-base-content/40 text-center py-8">Loading session context…</div>
          ) : (
            <>
              {/* Zone 1 — Context Summary */}
              <div className="border border-base-content/10 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-base-content/60 uppercase tracking-wider bg-base-content/5 hover:bg-base-content/10"
                  onClick={() => setSummaryVisible((v) => !v)}
                >
                  <span>What the previous agent did</span>
                  <span>{summaryVisible ? '▲ Hide' : '▼ Show'}</span>
                </button>
                {summaryVisible && (
                  <div className="p-3 text-xs font-mono text-base-content/70 space-y-1 bg-base-100/50">
                    {sbar ? (
                      <>
                        <div><span className="text-base-content/40">Situation:</span> {sbar.situation}</div>
                        <div><span className="text-base-content/40">Background:</span> {sbar.background}</div>
                        <div><span className="text-base-content/40">Assessment:</span> {sbar.assessment}</div>
                        <div><span className="text-base-content/40">Recommendation:</span> {sbar.recommendation}</div>
                        <div className="border-t border-base-content/10 pt-2 mt-2">
                          <div className="text-base-content/40 mb-1">Terminal tail (last 50 lines):</div>
                          <pre className="whitespace-pre-wrap break-all text-[10px] text-base-content/60">
                            {tail || '(no output)'}
                          </pre>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-base-content/40 mb-1">No SBAR available. Terminal tail:</div>
                        <pre className="whitespace-pre-wrap break-all text-[10px] text-base-content/60">
                          {tail || '(no output)'}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Zone 2 — Prompt editor */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                    Prompt for new agent
                  </label>
                  {prompt !== generatedPrompt && (
                    <button
                      className="text-[11px] text-info hover:text-info/80"
                      onClick={() => setPrompt(generatedPrompt)}
                    >
                      Reset to generated
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full h-48 text-xs font-mono bg-base-100 border border-base-content/15 rounded-lg p-3 text-base-content resize-y focus:outline-none focus:border-primary/50"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Write a new prompt or reset to generated."
                />
              </div>

              {/* Zone 3 — Agent config */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                  Agent configuration
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-base-content/50">Name</label>
                    <input
                      className="input input-xs w-full bg-base-100 border border-base-content/15 rounded text-base-content"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-base-content/50">Model</label>
                    <input
                      className="input input-xs w-full bg-base-100 border border-base-content/15 rounded text-base-content"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-base-content/50">Directory (cwd)</label>
                  <input
                    className="input input-xs w-full bg-base-100 border border-base-content/15 rounded text-base-content font-mono"
                    value={cwd}
                    onChange={(e) => setCwd(e.target.value)}
                  />
                </div>
                <div className="text-[11px] text-base-content/40">
                  Repo: <span className="text-base-content/60">{agent.repoId}</span>
                </div>
              </div>

              {spawnError && (
                <div className="text-xs text-error bg-error/10 rounded p-2">{spawnError}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-base-content/10 shrink-0">
          <button className="btn btn-xs btn-ghost text-base-content/60" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-xs btn-primary"
            disabled={loading || spawning || !cwd || !name}
            onClick={handleSpawn}
          >
            {spawning ? 'Spawning…' : 'Spawn Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
