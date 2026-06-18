import type { TaskItem, TaskStatus } from '@shared/types/task.types'

interface KanbanColumnProps {
  status: TaskStatus
  label: string
  tasks: TaskItem[]
  collapsed: boolean
  onToggleCollapse: () => void
  onCardDrop: (taskId: string, toStatus: TaskStatus) => void
  children: React.ReactNode
}

export function KanbanColumn({
  status,
  label,
  tasks,
  collapsed,
  onToggleCollapse,
  onCardDrop,
  children,
}: KanbanColumnProps) {
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) onCardDrop(taskId, status)
  }

  return (
    <div
      className="flex flex-col min-w-[200px] max-w-[260px] bg-base-200 rounded-lg"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        onClick={onToggleCollapse}
      >
        <span className="font-semibold text-sm">{label}</span>
        <span className="badge badge-sm">{tasks.length}</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-2 p-2 min-h-[80px]">
          {children}
        </div>
      )}
    </div>
  )
}
