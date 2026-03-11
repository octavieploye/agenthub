import type { TriageEvent } from '@shared/types/triage.types'
import type { ToastNotification, ToastSeverity } from '@shared/types/notification.types'

const TRIAGE_LEVEL_TO_SEVERITY: Record<TriageEvent['triageLevel'], ToastSeverity> = {
  low: 'info',
  medium: 'info',
  high: 'warning',
  critical: 'error',
}

export function buildToastFromTriageEvent(event: TriageEvent): ToastNotification {
  return {
    id: `triage-${event.agentId}-${event.timestamp}`,
    severity: TRIAGE_LEVEL_TO_SEVERITY[event.triageLevel],
    title: event.agentName,
    message: event.reason,
    agentId: event.agentId,
    agentName: event.agentName,
    createdAt: event.timestamp,
  }
}
