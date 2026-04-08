import type { AgentLifecycleStatus } from '@shared/types/agent.types'
import type { TriageInput, TriageEvent, TriageLevel } from '@shared/types/triage.types'

export const TRIAGE_LEVEL_ORDER: Record<TriageLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
}

const TRIAGE_RULES: Record<AgentLifecycleStatus, { level: TriageLevel; reason: string }> = {
  looping: { level: 'critical', reason: 'Agent stuck in loop' },
  paused: { level: 'critical', reason: 'Agent paused by guardrail' },
  locked: { level: 'high', reason: 'Agent needs user input' },
  interrupted: { level: 'high', reason: 'Agent interrupted' },
  completed: { level: 'medium', reason: 'Agent completed task' },
  spawning: { level: 'low', reason: 'Agent spawning' },
  busy: { level: 'low', reason: 'Agent working' },
  idle: { level: 'low', reason: 'Agent idle' },
  tray_running: { level: 'low', reason: 'Agent running in tray' },
  error: { level: 'critical', reason: 'Agent encountered an error' },
  awaiting_approval: { level: 'high', reason: 'Agent awaiting tool approval' }
}

export function triageAgentEvent(input: TriageInput): TriageEvent {
  const rule = TRIAGE_RULES[input.currentStatus]

  return {
    agentId: input.agentId,
    agentName: input.agentName,
    repoName: input.repoName,
    taskDescription: input.taskDescription,
    previousStatus: input.previousStatus,
    currentStatus: input.currentStatus,
    triageLevel: rule.level,
    timestamp: Date.now(),
    reason: rule.reason,
    requiresUserAction: input.currentStatus === 'awaiting_approval' || input.currentStatus === 'locked',
    requiresSoundAlert: input.currentStatus === 'awaiting_approval',
    isTaskCompleted: input.currentStatus === 'completed'
  }
}
