import React from 'react'
import type { TaskItem, TaskPriority, TaskCategory } from '@shared/types/task.types'
import { PRIORITY_LABEL, STATUS_LABEL, CATEGORY_LABEL } from '@shared/types/task.types'

interface KanbanCardProps {
  task: TaskItem
  agentColor?: string
  agentName?: string
  repoGlowColor?: string
  onSBARClick?: () => void
}

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  1: 'bg-error/15 text-error border-error/30',
  2: 'bg-warning/15 text-warning border-warning/30',
  3: 'bg-base-content/8 text-base-content/50 border-base-content/15'
}

const CATEGORY_CLASS: Record<TaskCategory, string> = {
  backend:       'bg-violet-500/15 text-violet-400 border-violet-500/25',
  frontend:      'bg-sky-500/15 text-sky-400 border-sky-500/25',
  database:      'bg-amber-500/15 text-amber-400 border-amber-500/25',
  schema:        'bg-teal-500/15 text-teal-400 border-teal-500/25',
  functionality: 'bg-green-500/15 text-green-400 border-green-500/25'
}

export function KanbanCard({ task, agentColor, agentName, repoGlowColor, onSBARClick }: KanbanCardProps) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const priorityLabel = PRIORITY_LABEL[task.priority]
  const priorityClass = PRIORITY_CLASS[task.priority]

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="relative group rounded-lg bg-base-100 border border-base-300 shadow-sm cursor-grab active:cursor-grabbing px-3 py-2.5 flex flex-col gap-2 hover:border-base-content/20 transition-colors"
      style={repoGlowColor ? { borderLeftColor: repoGlowColor, borderLeftWidth: 3 } : undefined}
    >
      {task.note && (
        <div className="absolute bottom-full left-0 mb-1.5 z-50 hidden group-hover:block bg-base-300 border border-base-content/20 rounded-lg px-3 py-2 text-xs text-base-content/80 max-w-[240px] whitespace-pre-wrap shadow-xl pointer-events-none">
          {task.note}
        </div>
      )}
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</span>
        <span
          className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityClass}`}
        >
          {priorityLabel}
        </span>
      </div>

      {/* Category + sprint */}
      {(task.category || task.sprintName) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.category && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_CLASS[task.category]}`}
            >
              {CATEGORY_LABEL[task.category]}
            </span>
          )}
          {task.sprintName && (
            <span className="text-[10px] text-base-content/40 truncate max-w-[90px]">
              {task.sprintName}
            </span>
          )}
        </div>
      )}

      {/* Footer: dots + SBAR */}
      <div className="flex items-center gap-1.5">
        {repoGlowColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0 border border-base-300"
            style={{ backgroundColor: repoGlowColor }}
            title="Repo"
          />
        )}
        {agentColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: agentColor }}
            title={agentName}
          />
        )}
        {task.note && (
          <span className="text-[10px] text-base-content/40" title={task.note}>✎</span>
        )}
        <span className="text-[10px] text-base-content/35 ml-auto">
          {STATUS_LABEL[task.status]}
        </span>
        {task.sbarId && onSBARClick && (
          <button
            className="btn btn-xs btn-ghost py-0 h-5 min-h-0 text-[10px]"
            onClick={onSBARClick}
            title="View SBAR summary"
          >
            SBAR
          </button>
        )}
      </div>
    </div>
  )
}
