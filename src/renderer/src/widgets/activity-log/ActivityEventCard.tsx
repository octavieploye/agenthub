import type { ActivityEvent } from '@shared/types/activity.types'

const EVENT_ICONS: Record<string, string> = {
  agent_spawned: '\u{1F680}',
  agent_status_changed: '\u{1F504}',
  agent_completed: '\u2705',
  agent_interrupted: '\u26A0\uFE0F',
  agent_respawned: '\u267B\uFE0F',
  agent_error: '\u274C',
  task_created: '\u{1F4CB}',
  task_status_changed: '\u{1F4DD}',
  bug_created: '\u{1F41B}',
  bug_resolved: '\u{1F527}',
  note_created: '\u{1F4D2}',
  repo_added: '\u{1F4C2}'
}

const EVENT_LABELS: Record<string, string> = {
  agent_spawned: 'Agent spawned',
  agent_status_changed: 'Status changed',
  agent_completed: 'Agent completed',
  agent_interrupted: 'Agent interrupted',
  agent_respawned: 'Agent respawned',
  agent_error: 'Agent error',
  task_created: 'Task created',
  task_status_changed: 'Task updated',
  bug_created: 'Bug reported',
  bug_resolved: 'Bug resolved',
  note_created: 'Note created',
  repo_added: 'Repo added'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDetails(event: ActivityEvent): string {
  const d = event.details
  switch (event.eventType) {
    case 'agent_spawned':
      return `${d.name ?? ''} (${d.model ?? ''})`
    case 'agent_status_changed':
      return `${d.from ?? '?'} \u2192 ${d.to ?? '?'}`
    case 'agent_completed':
      return `exit code ${d.exitCode ?? '?'}`
    case 'agent_error':
      return String(d.errorMessage ?? 'Unknown error')
    case 'agent_respawned':
      return d.hasSbar ? 'with SBAR context' : 'fresh start'
    case 'agent_interrupted':
      return d.hasSbar ? 'handoff saved' : 'no handoff'
    case 'task_created':
      return String(d.title ?? '')
    case 'task_status_changed':
      return `\u2192 ${d.to ?? '?'}`
    case 'bug_created':
      return `[${d.severity ?? '?'}] ${d.errorType ?? ''}`
    case 'bug_resolved':
      return 'resolved'
    case 'note_created':
      return String(d.type ?? '')
    case 'repo_added':
      return String(d.name ?? '')
    default:
      return ''
  }
}

interface Props {
  event: ActivityEvent
  showDate?: boolean
}

export default function ActivityEventCard({ event, showDate }: Props): React.JSX.Element {
  const icon = EVENT_ICONS[event.eventType] ?? '\u{1F4CC}'
  const label = EVENT_LABELS[event.eventType] ?? event.eventType

  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-base-content/5 rounded-lg transition-colors">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-base-content/50">
            {showDate
              ? new Date(event.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' '
              : ''}
            {formatTime(event.createdAt)}
          </span>
        </div>
        <div className="text-xs text-base-content/60 truncate">{formatDetails(event)}</div>
      </div>
      <span className="text-[10px] text-base-content/30 uppercase tracking-wider shrink-0">
        {event.entityType}
      </span>
    </div>
  )
}
