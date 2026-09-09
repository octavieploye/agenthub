const STATUS_CLASS: Record<string, string> = {
  running:   'badge-primary animate-pulse',
  completed: 'badge-success',
  failed:    'badge-error',
  cancelled: 'badge-ghost',
}

function statusClass(status: string): string {
  return STATUS_CLASS[status] ?? 'badge-ghost opacity-70'
}

interface KanbanCardOrchestratorBadgeProps {
  skill: string | null
  status: string
}

export function KanbanCardOrchestratorBadge({ skill, status }: KanbanCardOrchestratorBadgeProps) {
  const label = skill ?? 'running'
  return (
    <span
      className={`badge badge-xs text-[10px] ${statusClass(status)}`}
      title={`${label}: ${status}`}
    >
      {label} · {status}
    </span>
  )
}
