import React from 'react'
import type { AgentState } from '@shared/types/agent.types'

interface ShutdownDialogProps {
  activeAgents: AgentState[]
  onLetThemFinish: () => void
  onKillAllAndClose: () => void
  onCancel: () => void
}

function statusDotClass(status: AgentState['status']): string {
  const map: Record<string, string> = {
    busy: 'bg-warning shadow-warning/60',
    locked: 'bg-orange-500 shadow-orange-500/60 animate-breathe',
    idle: 'bg-success shadow-success/60',
    spawning: 'bg-info shadow-info/60'
  }
  return map[status] ?? 'bg-base-content/40'
}

function formatElapsed(createdAt: string): string {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'just started'
  return `${minutes} min`
}

export function ShutdownDialog({
  activeAgents,
  onLetThemFinish,
  onKillAllAndClose,
  onCancel
}: ShutdownDialogProps): React.JSX.Element {
  const lockedAgents = activeAgents.filter((a) => a.status === 'locked')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-100/80 backdrop-blur-sm"
      data-testid="shutdown-overlay"
    >
      <div className="panel-glass max-w-125 w-full p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold" data-testid="shutdown-title">
            {activeAgents.length} agent{activeAgents.length !== 1 ? 's are' : ' is'} still active
          </h2>
          <p className="text-sm text-base-content/60 mt-1">
            What would you like to do?
          </p>
        </div>

        <div className="space-y-1.5">
          {activeAgents.map((agent) => (
            <div
              key={agent.id}
              className={`panel-glass flex items-center gap-3 py-2.5 px-3.5 ${
                agent.status === 'locked' ? 'border-l-2 border-orange-500' : ''
              }`}
              data-testid={`shutdown-agent-${agent.id}`}
            >
              <div className={`w-2 h-2 rounded-full ${statusDotClass(agent.status)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {agent.name} &mdash; {agent.repoId}
                </div>
                <div className={`text-[11px] ${
                  agent.status === 'locked' ? 'text-orange-400' : 'text-base-content/50'
                }`}>
                  {agent.status === 'locked'
                    ? 'Waiting for your input'
                    : `Running ${formatElapsed(agent.createdAt)}`}
                </div>
              </div>
            </div>
          ))}
        </div>

        {lockedAgents.length > 0 && (
          <div className="text-xs text-orange-400/80" data-testid="locked-warning">
            {lockedAgents.length} agent{lockedAgents.length !== 1 ? 's are' : ' is'} waiting for YOUR input.
            They cannot finish without you.
          </div>
        )}

        <div className="space-y-2">
          <button
            className="w-full panel-glass p-3.5 text-left hover:border-primary/40 hover:shadow-primary/15 hover:shadow-lg transition-all cursor-pointer border border-primary/20"
            onClick={onLetThemFinish}
            data-testid="let-them-finish"
          >
            <div className="text-sm font-semibold text-info">Let Them Finish</div>
            <div className="text-xs text-base-content/50 mt-0.5">
              App minimizes to system tray. Sound alert when all done. Guardrails active.
            </div>
          </button>

          <button
            className="w-full panel-glass p-3.5 text-left hover:border-base-content/15 transition-all cursor-pointer"
            onClick={onKillAllAndClose}
            data-testid="kill-all-close"
          >
            <div className="text-sm font-semibold text-error">Kill All & Close</div>
            <div className="text-xs text-base-content/50 mt-0.5">
              All agents terminated. Tasks marked &apos;interrupted.&apos; Recoverable on next launch.
            </div>
          </button>

          <button
            className="w-full panel-glass p-3.5 text-left hover:border-base-content/15 transition-all cursor-pointer"
            onClick={onCancel}
            data-testid="cancel-shutdown"
          >
            <div className="text-sm font-semibold">Cancel</div>
            <div className="text-xs text-base-content/50 mt-0.5">
              Return to AgentHub.
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
