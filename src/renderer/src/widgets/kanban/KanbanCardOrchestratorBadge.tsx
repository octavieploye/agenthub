import type { OrchestratorPhase, OrchestratorPhaseStatus } from '@shared/types/orchestrator.types'

const PHASE_ICON: Record<OrchestratorPhase, string> = {
  dev:      '\u2699',
  review:   '\uD83D\uDC41',
  security: '\uD83D\uDEE1',
  commit:   '\uD83D\uDCDD',
  push:     '\uD83D\uDE80'
}

const PHASE_STATUS_CLASS: Record<OrchestratorPhaseStatus, string> = {
  pending: 'badge-ghost opacity-50',
  active:  'badge-primary animate-pulse',
  done:    'badge-success',
  failed:  'badge-error',
  skipped: 'badge-ghost'
}

interface KanbanCardOrchestratorBadgeProps {
  phase: OrchestratorPhase
  status: OrchestratorPhaseStatus
}

export function KanbanCardOrchestratorBadge({ phase, status }: KanbanCardOrchestratorBadgeProps) {
  return (
    <span
      className={`badge badge-xs text-[10px] ${PHASE_STATUS_CLASS[status]}`}
      title={`${phase}: ${status}`}
    >
      {PHASE_ICON[phase]} {phase}
    </span>
  )
}
