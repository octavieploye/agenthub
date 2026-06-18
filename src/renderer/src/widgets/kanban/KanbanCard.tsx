import type { TaskItem } from '@shared/types/task.types'

interface KanbanCardProps {
  task: TaskItem
  agentColor?: string
  agentName?: string
  onSBARClick?: () => void
}

const PRIORITY_BADGE: Record<number, string> = {
  1: 'badge-error',
  2: 'badge-warning',
  3: 'badge-ghost'
}

export function KanbanCard({ task, agentColor, agentName, onSBARClick }: KanbanCardProps) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="card card-compact bg-base-100 shadow-sm cursor-grab active:cursor-grabbing border border-base-300"
    >
      <div className="card-body gap-1">
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-medium line-clamp-2">{task.title}</span>
          <span className={`badge badge-xs shrink-0 ${PRIORITY_BADGE[task.priority]}`}>P{task.priority}</span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {task.sprintName && (
            <span className="text-xs text-base-content/50 truncate max-w-[80px]">{task.sprintName}</span>
          )}
          {agentColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: agentColor }}
              title={agentName}
            />
          )}
          {task.sbarId && (
            <button
              className="btn btn-xs btn-ghost ml-auto"
              onClick={onSBARClick}
              title="View SBAR summary"
            >
              SBAR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
