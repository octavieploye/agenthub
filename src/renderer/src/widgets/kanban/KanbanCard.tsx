import React, { useState, useRef, useEffect } from 'react'
import type { TaskItem, TaskPriority, UpdateTaskInput } from '@shared/types/task.types'
import { PRIORITY_LABEL, STATUS_LABEL, CATEGORY_LABEL, KNOWN_CATEGORIES } from '@shared/types/task.types'
import type { AgentState, AgentLifecycleStatus } from '@shared/types/agent.types'
import { KanbanCardPopover } from './KanbanCardPopover'

interface KanbanCardProps {
  task: TaskItem
  agentColor?: string
  agentName?: string
  agentStatus?: AgentLifecycleStatus
  repoGlowColor?: string
  defaultProjectId?: string
  agents?: AgentState[]
  onSBARClick?: () => void
  onPriorityChange?: (priority: TaskPriority) => void
  onDelete?: () => void
  onEdit?: (input: UpdateTaskInput) => void
  onDispatch?: () => void
  onBadgeClick?: () => void
  blockedByCount?: number
}

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  1: 'bg-error/15 text-error border-error/30',
  2: 'bg-warning/15 text-warning border-warning/30',
  3: 'bg-base-content/8 text-base-content/50 border-base-content/15'
}

const CATEGORY_CLASS: Record<string, string> = {
  backend:       'bg-violet-500/15 text-violet-400 border-violet-500/25',
  frontend:      'bg-sky-500/15 text-sky-400 border-sky-500/25',
  database:      'bg-amber-500/15 text-amber-400 border-amber-500/25',
  schema:        'bg-teal-500/15 text-teal-400 border-teal-500/25',
  functionality: 'bg-green-500/15 text-green-400 border-green-500/25'
}
const DEFAULT_CATEGORY_CLASS = 'bg-base-content/8 text-base-content/50 border-base-content/15'

const STATUS_BADGE: Record<string, { label: string; pulse: boolean; class: string }> = {
  spawning:          { label: 'In Progress', pulse: true,  class: 'text-info' },
  busy:              { label: 'In Progress', pulse: true,  class: 'text-info' },
  looping:           { label: 'In Progress', pulse: true,  class: 'text-info' },
  idle:              { label: 'Idle',        pulse: false, class: 'text-success' },
  awaiting_approval: { label: 'Idle',        pulse: false, class: 'text-warning' },
  completed:         { label: 'Done',        pulse: false, class: 'text-base-content/40' },
  interrupted:       { label: 'Stopped',     pulse: false, class: 'text-base-content/40' },
}

function cyclePriority(p: TaskPriority): TaskPriority {
  return p === 1 ? 2 : p === 2 ? 3 : 1
}

function computePopoverPosition(rect: DOMRect): { top: number; left: number } {
  const popoverWidth = 340
  const gap = 12
  const rightSpace = window.innerWidth - rect.right
  const leftSpace = rect.left
  let left: number
  if (rightSpace >= popoverWidth + gap) {
    left = rect.right + gap
  } else if (leftSpace >= popoverWidth + gap) {
    left = rect.left - popoverWidth - gap
  } else {
    left = Math.max(0, (window.innerWidth - popoverWidth) / 2)
  }
  const estimatedMaxHeight = Math.min(window.innerHeight * 0.8, 600)
  const top = Math.min(rect.top, window.innerHeight - estimatedMaxHeight - 12)
  return { top, left }
}

export function KanbanCard({ task, agentColor, agentName, agentStatus, repoGlowColor, defaultProjectId, agents, onSBARClick, onPriorityChange, onDelete, onEdit, onDispatch, onBadgeClick, blockedByCount = 0 }: KanbanCardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editNote, setEditNote] = useState('')
  const [popoverVisible, setPopoverVisible] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [pinned, setPinned] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close popover and cancel open timer when inline edit activates
  useEffect(() => {
    if (editing) {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
      setPopoverVisible(false)
    }
  }, [editing])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  function scheduleClose() {
    closeTimerRef.current = setTimeout(() => {
      setPopoverVisible(false)
    }, 150)
  }

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function handleCardMouseEnter() {
    if (editing || popoverVisible) return
    openTimerRef.current = setTimeout(() => {
      if (!cardRef.current) return
      const rect = cardRef.current.getBoundingClientRect()
      setPopoverPos(computePopoverPosition(rect))
      setPopoverVisible(true)
    }, 650)
  }

  function handleCardMouseLeave() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    scheduleClose()
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function startEdit() {
    setEditTitle(task.title)
    setEditCategory(task.category ?? '')
    setEditNote(task.note ?? '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  function submitEdit() {
    if (!editTitle.trim()) return
    onEdit?.({ title: editTitle.trim(), category: editCategory.trim() || null, note: editNote.trim() || null })
    setEditing(false)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDelete) {
      onDelete?.()
    } else {
      setConfirmDelete(true)
    }
  }

  async function handlePin(e: React.MouseEvent) {
    e.stopPropagation()
    if (!defaultProjectId) return
    const content = task.note ? `${task.title}\n${task.note}` : task.title
    try {
      const res = await window.agentHub.workspaceMemory.pin(defaultProjectId, content)
      if (res.success) {
        setPinned(true)
        setTimeout(() => setPinned(false), 2000)
      }
    } catch {
      // silent fail — pin is best-effort
    }
  }

  const priorityLabel = PRIORITY_LABEL[task.priority]
  const priorityClass = PRIORITY_CLASS[task.priority]

  if (editing) {
    return (
      <div className="rounded-lg bg-base-100 border border-primary/50 shadow-sm px-3 py-2.5 flex flex-col gap-2">
        <input
          autoFocus
          className="input input-xs input-bordered w-full"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') cancelEdit() }}
          placeholder="Title"
        />
        <input
          list={`edit-cat-${task.id}`}
          className="input input-xs input-bordered w-full"
          placeholder="Category…"
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
        />
        <datalist id={`edit-cat-${task.id}`}>
          {KNOWN_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </datalist>
        <textarea
          className="textarea textarea-xs textarea-bordered w-full resize-none"
          rows={2}
          placeholder="Note…"
          value={editNote}
          onChange={(e) => setEditNote(e.target.value)}
        />
        <div className="flex gap-1 justify-end">
          <button className="btn btn-xs btn-ghost" onClick={cancelEdit}>Cancel</button>
          <button className="btn btn-xs btn-primary" onClick={submitEdit}>Save</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onMouseEnter={handleCardMouseEnter}
        onMouseLeave={() => { handleCardMouseLeave(); setConfirmDelete(false) }}
        className="relative group rounded-lg bg-base-100 border border-base-300 shadow-sm cursor-grab active:cursor-grabbing px-3 py-2.5 flex flex-col gap-2 hover:border-base-content/20 transition-colors"
        style={repoGlowColor ? { borderLeftColor: repoGlowColor, borderLeftWidth: 3 } : undefined}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</span>
          <span
            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityClass} ${onPriorityChange ? 'cursor-pointer hover:opacity-70' : ''}`}
            title={onPriorityChange ? 'Click to cycle priority' : undefined}
            onClick={onPriorityChange ? (e) => { e.stopPropagation(); onPriorityChange(cyclePriority(task.priority)) } : undefined}
          >
            {priorityLabel}
          </span>
        </div>

        {/* Agent status badge */}
        {task.agentId && agentStatus && STATUS_BADGE[agentStatus] && (
          <div
            data-testid="agent-status-badge"
            className={`flex items-center gap-1.5 text-[10px] font-medium ${STATUS_BADGE[agentStatus].class}${onBadgeClick ? ' cursor-pointer' : ''}`}
            onClick={onBadgeClick ? (e) => { e.stopPropagation(); onBadgeClick() } : undefined}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGE[agentStatus].pulse ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: agentColor ?? '#6B7280' }}
            />
            <span>{agentName ?? 'Agent'}</span>
            <span className="text-base-content/30">·</span>
            <span>{STATUS_BADGE[agentStatus].label}</span>
          </div>
        )}

        {/* Category + sprint */}
        {(task.category || task.sprintName) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.category && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_CLASS[task.category] ?? DEFAULT_CATEGORY_CLASS}`}>
                {CATEGORY_LABEL[task.category] ?? task.category}
              </span>
            )}
            {task.sprintName && (
              <span className="text-[10px] text-base-content/40 truncate max-w-[90px]">{task.sprintName}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5">
          {blockedByCount > 0 && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-warning/15 text-warning border-warning/30"
              title={`Blocked by ${blockedByCount} task${blockedByCount > 1 ? 's' : ''}`}
            >
              Blocked {blockedByCount}
            </span>
          )}
          {repoGlowColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0 border border-base-300"
              style={{ backgroundColor: repoGlowColor }}
              title="Repo"
            />
          )}
          {agentColor && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agentColor }} title={agentName} />
          )}
          {task.note && (
            <span className="text-[10px] text-base-content/40">✎</span>
          )}
          <span className="text-[10px] text-base-content/35 ml-auto">{STATUS_LABEL[task.status]}</span>
          {onEdit && (
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 text-base-content/40 hover:text-base-content"
              title="Edit task"
              onMouseEnter={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); startEdit() }}
            >✏</button>
          )}
          {onDispatch && (
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 text-warning/60 hover:text-warning"
              title="Dispatch to agent"
              onMouseEnter={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDispatch() }}
            >⚡</button>
          )}
          {onDelete && (
            <button
              className={`opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 ${confirmDelete ? 'text-error' : 'text-base-content/40 hover:text-error'}`}
              title={confirmDelete ? 'Click again to confirm' : 'Delete task'}
              onMouseEnter={(e) => e.stopPropagation()}
              onClick={handleDeleteClick}
            >{confirmDelete ? '✓' : '✕'}</button>
          )}
          {task.sbarId && onSBARClick && (
            <button
              className="btn btn-xs btn-ghost py-0 h-5 min-h-0 text-[10px]"
              onClick={onSBARClick}
              title="View SBAR summary"
            >SBAR</button>
          )}
          {task.status === 'completed' && defaultProjectId && (
            <button
              className={`opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 ${pinned ? 'text-success' : 'text-base-content/40 hover:text-success'}`}
              title={pinned ? 'Pinned!' : 'Pin as learning'}
              onMouseEnter={(e) => e.stopPropagation()}
              onClick={handlePin}
              data-testid="pin-button"
            >
              {pinned ? '✓' : '📌'}
            </button>
          )}
        </div>
      </div>

      {popoverVisible && onEdit && (
        <KanbanCardPopover
          task={task}
          position={popoverPos}
          onSave={(input) => onEdit(input)}
          onClose={() => setPopoverVisible(false)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          defaultProjectId={defaultProjectId}
          agents={agents ?? []}
        />
      )}
    </>
  )
}
