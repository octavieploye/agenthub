import React, { useState } from 'react'
import type { RecoveryInfo, SBARHandoff, SessionGroup } from '@shared/types/recovery.types'
import type { AgentState } from '@shared/types/agent.types'
import { TruncatedText } from '../../components/TruncatedText'

interface RecoveryScreenProps {
  recoveryInfo: RecoveryInfo
  onContinue: () => void
  onResumeAgent?: (agentId: string) => void
  onViewOutput?: (agentId: string) => void
  onDropAgent?: (agentId: string) => void
  onDropAll?: () => void
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
          <div><span className="font-semibold text-base-content/80">Situation:</span> <TruncatedText text={handoff.situation} className="text-xs" /></div>
          <div><span className="font-semibold text-base-content/80">Background:</span> <TruncatedText text={handoff.background} className="text-xs" /></div>
          <div><span className="font-semibold text-base-content/80">Assessment:</span> <TruncatedText text={handoff.assessment} className="text-xs" /></div>
          <div><span className="font-semibold text-base-content/80">Recommendation:</span> <TruncatedText text={handoff.recommendation} className="text-xs" /></div>
        </div>
      )}
    </div>
  )
}

function closeReasonLabel(reason: string): string {
  switch (reason) {
    case 'crash': return 'Crashed'
    case 'clean': return 'Closed normally'
    default: return 'Unknown'
  }
}

function AgentCard({
  agent,
  isRecovered,
  onResumeAgent,
  onViewOutput,
  onDropAgent
}: {
  agent: AgentState & { handoff?: SBARHandoff }
  isRecovered: boolean
  onResumeAgent?: (id: string) => void
  onViewOutput?: (id: string) => void
  onDropAgent?: (id: string) => void
}): React.JSX.Element {
  return (
    <div
      className={`panel-glass flex items-start gap-3 p-3 border-l-[3px] ${isRecovered ? 'border-success' : 'border-warning'}`}
      data-testid={`${isRecovered ? 'recovered' : 'interrupted'}-agent-${agent.id}`}
    >
      <div className={`w-2.5 h-2.5 rounded-full mt-1 shadow-sm ${statusDotClass(agent.status)}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{agent.name}</div>
        <div className="text-xs text-base-content/50">
          {agent.repoId} &mdash;{' '}
          {isRecovered ? 'RECONNECTED' : 'INTERRUPTED'} &mdash;{' '}
          {isRecovered
            ? 'Agent is still working'
            : <TruncatedText text={agent.taskDescription || 'No task description'} className="text-xs" />
          }
        </div>
        {'handoff' in agent && agent.handoff && (
          <SBARDetail handoff={agent.handoff as SBARHandoff} />
        )}
        {!isRecovered && (
          <div className="flex gap-1.5 mt-2">
            {onResumeAgent && (
              <button
                className="btn-lcars text-xs px-3 py-1 text-success"
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
        )}
      </div>
    </div>
  )
}

function SessionGroupView({
  group,
  isFirst,
  recoveredIds,
  onResumeAgent,
  onViewOutput,
  onDropAgent
}: {
  group: SessionGroup
  isFirst: boolean
  recoveredIds: Set<string>
  onResumeAgent?: (id: string) => void
  onViewOutput?: (id: string) => void
  onDropAgent?: (id: string) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(isFirst)

  const sessionLabel = group.session
    ? `Session ${group.session.startedAt.slice(0, 16).replace('T', ' ')} — ${closeReasonLabel(group.session.closeReason)}`
    : 'Unknown session'

  return (
    <div data-testid={`session-group-${group.session?.id ?? 'unknown'}`}>
      <button
        className="w-full flex items-center justify-between text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2 hover:text-base-content/80"
        onClick={() => setExpanded(!expanded)}
        data-testid={`session-toggle-${group.session?.id ?? 'unknown'}`}
      >
        <span>{sessionLabel} ({group.agents.length} agent{group.agents.length > 1 ? 's' : ''})</span>
        <span>{expanded ? '▲' : '▼ See more'}</span>
      </button>
      {expanded && (
        <div className="space-y-2 mb-4">
          {group.agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isRecovered={recoveredIds.has(agent.id)}
              onResumeAgent={onResumeAgent}
              onViewOutput={onViewOutput}
              onDropAgent={onDropAgent}
            />
          ))}
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
  onDropAgent,
  onDropAll
}: RecoveryScreenProps): React.JSX.Element {
  const { recoveredAgents, interruptedAgents, lastSnapshot, sessionGroups } = recoveryInfo

  const totalRecovered = recoveredAgents.length
  const totalInterrupted = interruptedAgents.length
  const totalAgents = totalRecovered + totalInterrupted
  const recoveredIds = new Set(recoveredAgents.map((a) => a.id))

  const hasSessionGroups = (sessionGroups ?? []).length > 0

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

        {hasSessionGroups ? (
          (sessionGroups ?? []).map((group, idx) => (
            <SessionGroupView
              key={group.session?.id ?? 'unknown'}
              group={group}
              isFirst={idx === 0}
              recoveredIds={recoveredIds}
              onResumeAgent={onResumeAgent}
              onViewOutput={onViewOutput}
              onDropAgent={onDropAgent}
            />
          ))
        ) : (
          <>
            {recoveredAgents.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-success uppercase tracking-wider mb-2" data-testid="recovered-heading">
                  Recovered (still running)
                </h2>
                <div className="space-y-2">
                  {recoveredAgents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} isRecovered={true} />
                  ))}
                </div>
              </div>
            )}
            {interruptedAgents.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-warning uppercase tracking-wider mb-2" data-testid="interrupted-heading">
                  Interrupted (process ended)
                </h2>
                <div className="space-y-2">
                  {interruptedAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      isRecovered={false}
                      onResumeAgent={onResumeAgent}
                      onViewOutput={onViewOutput}
                      onDropAgent={onDropAgent}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="panel-glass p-4 text-center space-y-3">
          {lastSnapshot && (
            <div className="text-xs text-base-content/50">
              Dashboard layout restored from last save
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            {onDropAll && totalAgents > 1 && (
              <button
                className="btn btn-error btn-outline rounded-full px-6"
                onClick={onDropAll}
                data-testid="drop-all-button"
              >
                Drop All &amp; Start Fresh
              </button>
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
    </div>
  )
}
