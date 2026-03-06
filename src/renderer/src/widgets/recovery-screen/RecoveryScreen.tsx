import React, { useState } from 'react'
import type { RecoveryInfo, SBARHandoff } from '@shared/types/recovery.types'
import type { AgentState } from '@shared/types/agent.types'

interface RecoveryScreenProps {
  recoveryInfo: RecoveryInfo
  onContinue: () => void
  onResumeAgent?: (agentId: string) => void
  onViewOutput?: (agentId: string) => void
  onDropAgent?: (agentId: string) => void
}

function statusDotClass(status: AgentState['status']): string {
  const map: Record<string, string> = {
    busy: 'bg-warning shadow-warning/60',
    idle: 'bg-success shadow-success/60',
    locked: 'bg-orange-500 shadow-orange-500/60 animate-breathe',
    completed: 'bg-success',
    interrupted: 'bg-warning',
    spawning: 'bg-info shadow-info/60'
  }
  return map[status] ?? 'bg-base-content/40'
}

function SBARDetail({ handoff }: { handoff: SBARHandoff }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2">
      <button
        className="text-xs text-info hover:text-info/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide' : 'View'} handoff summary
      </button>
      {expanded && (
        <div className="mt-2 text-xs text-base-content/60 space-y-1 pl-2 border-l-2 border-info/30">
          <div><span className="font-semibold text-base-content/80">Situation:</span> {handoff.situation}</div>
          <div><span className="font-semibold text-base-content/80">Background:</span> {handoff.background}</div>
          <div><span className="font-semibold text-base-content/80">Assessment:</span> {handoff.assessment}</div>
          <div><span className="font-semibold text-base-content/80">Recommendation:</span> {handoff.recommendation}</div>
        </div>
      )}
    </div>
  )
}

export function RecoveryScreen({
  recoveryInfo,
  onContinue,
  onResumeAgent,
  onViewOutput,
  onDropAgent
}: RecoveryScreenProps): React.JSX.Element {
  const { recoveredAgents, interruptedAgents, lastSnapshot } = recoveryInfo

  const totalRecovered = recoveredAgents.length
  const totalInterrupted = interruptedAgents.length

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-base-100">
      <div className="max-w-[700px] w-full space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-base-content" data-testid="recovery-title">
            Session Recovery
          </h1>
          <p className="text-sm text-base-content/60 mt-1" data-testid="recovery-subtitle">
            {totalRecovered > 0 && totalInterrupted > 0
              ? `We recovered ${totalRecovered} agent${totalRecovered > 1 ? 's' : ''} and ${totalInterrupted} ${totalInterrupted > 1 ? 'were' : 'was'} interrupted.`
              : totalRecovered > 0
                ? `We recovered ${totalRecovered} agent${totalRecovered > 1 ? 's' : ''} that ${totalRecovered > 1 ? 'are' : 'is'} still running.`
                : `${totalInterrupted} agent${totalInterrupted > 1 ? 's were' : ' was'} interrupted while working.`}
          </p>
        </div>

        {recoveredAgents.length > 0 && (
          <div>
            <h2
              className="text-xs font-semibold text-success uppercase tracking-wider mb-2"
              data-testid="recovered-heading"
            >
              Recovered (still running)
            </h2>
            <div className="space-y-2">
              {recoveredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="panel-glass flex items-center gap-3 p-3 border-l-[3px] border-success"
                  data-testid={`recovered-agent-${agent.id}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${statusDotClass(agent.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{agent.name}</div>
                    <div className="text-xs text-base-content/50">
                      {agent.repoId} &mdash; RECONNECTED &mdash; Agent is still working
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {interruptedAgents.length > 0 && (
          <div>
            <h2
              className="text-xs font-semibold text-warning uppercase tracking-wider mb-2"
              data-testid="interrupted-heading"
            >
              Interrupted (process ended)
            </h2>
            <div className="space-y-2">
              {interruptedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="panel-glass flex items-start gap-3 p-3 border-l-[3px] border-warning"
                  data-testid={`interrupted-agent-${agent.id}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full mt-1 bg-warning shadow-warning/60" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{agent.name}</div>
                    <div className="text-xs text-base-content/50">
                      {agent.repoId} &mdash; INTERRUPTED &mdash;{' '}
                      {agent.taskDescription || 'No task description'}
                    </div>
                    {'handoff' in agent && agent.handoff && (
                      <SBARDetail handoff={agent.handoff as SBARHandoff} />
                    )}
                    <div className="flex gap-1.5 mt-2">
                      {onResumeAgent && (
                        <button
                          className="btn-lcars text-xs px-3 py-1"
                          onClick={() => onResumeAgent(agent.id)}
                          data-testid={`resume-${agent.id}`}
                        >
                          Resume
                        </button>
                      )}
                      {onViewOutput && (
                        <button
                          className="btn-lcars text-xs px-3 py-1"
                          onClick={() => onViewOutput(agent.id)}
                          data-testid={`view-output-${agent.id}`}
                        >
                          View Output
                        </button>
                      )}
                      {onDropAgent && (
                        <button
                          className="btn-lcars text-xs px-3 py-1 text-error"
                          onClick={() => onDropAgent(agent.id)}
                          data-testid={`drop-${agent.id}`}
                        >
                          Drop
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="panel-glass p-4 text-center space-y-3">
          {lastSnapshot && (
            <div className="text-xs text-base-content/50">
              Dashboard layout restored from last save
            </div>
          )}
          <button
            className="btn btn-primary rounded-full px-8 shadow-lg shadow-primary/30"
            onClick={onContinue}
            data-testid="continue-button"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
