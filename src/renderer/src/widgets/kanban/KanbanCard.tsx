import React, { useState, useRef, useEffect } from 'react'
import { GripHorizontal, Pencil, Zap, X, Check, Pin, FileText, Rocket } from 'lucide-react'
import type { TaskItem, TaskPriority, UpdateTaskInput } from '@shared/types/task.types'
import { PRIORITY_LABEL, STATUS_LABEL, CATEGORY_LABEL, KNOWN_CATEGORIES } from '@shared/types/task.types'
import type { AgentState, AgentLifecycleStatus } from '@shared/types/agent.types'
import type { OrchestratorPhase, OrchestratorPhaseStatus, OrchestratorTaskLog } from '@shared/types/orchestrator.types'
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
  onAutoPipeline?: () => void
  isOrchestratorActive?: boolean
  onBadgeClick?: () => void
  blockedByCount?: number
  /** Number of blockers that are not yet completed/tested */
  unresolvedBlockerCount?: number
  /** Current orchestrator phase + status for this task */
  orchestratorPhase?: {
    phase: OrchestratorPhase
    status: OrchestratorPhaseStatus
  }
  phaseHistory?: OrchestratorTaskLog[]
}

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  1: 'badge-error',
  2: 'badge-warning',
  3: 'badge-ghost'
}

const CATEGORY_DOT_COLOR: Record<string, string> = {
  backend:       '#8B5CF6',
  frontend:      '#38BDF8',
  database:      '#F59E0B',
  schema:        '#2DD4BF',
  functionality: '#22C55E',
  marketing:     '#EC4899',
  research:      '#A78BFA',
  business:      '#F97316',
  content:       '#06B6D4',
}
const DEFAULT_DOT_COLOR = '#6B7280'

const STATUS_BADGE: Record<string, { label: string; pulse: boolean; class: string }> = {
  spawning:          { label: 'In Progress', pulse: true,  class: 'text-info' },
  busy:              { label: 'In Progress', pulse: true,  class: 'text-info' },
  looping:           { label: 'In Progress', pulse: true,  class: 'text-info' },
  idle:              { label: 'Idle',        pulse: false, class: 'text-success' },
  awaiting_approval: { label: 'Idle',        pulse: false, class: 'text-warning' },
  completed:         { label: 'Done',        pulse: false, class: 'text-base-content/40' },
  interrupted:       { label: 'Stopped',     pulse: false, class: 'text-base-content/40' },
}

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

export function KanbanCard({
  task, agentColor, agentName, agentStatus, repoGlowColor, defaultProjectId, agents,
  onSBARClick, onPriorityChange, onDelete, onEdit, onDispatch, onAutoPipeline, isOrchestratorActive, onBadgeClick, blockedByCount = 0, unresolvedBlockerCount = 0,
  orchestratorPhase, phaseHistory
}: KanbanCardProps) {
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
  const pinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (editing) {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
      setPopoverVisible(false)
    }
  }, [editing])

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      if (pinTimerRef.current) clearTimeout(pinTimerRef.current)
    }
  }, [])

  function scheduleClose() {
    closeTimerRef.current = setTimeout(() => { setPopoverVisible(false) }, 150)
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
    }, 900)
  }

  function handleCardMouseLeave() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    scheduleClose()
  }

  function handleDragStart(e: React.DragEvent) {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    setPopoverVisible(false)
    if (e.dataTransfer) {
      e.dataTransfer.setData('taskId', task.id)
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  function startEdit() {
    setEditTitle(task.title)
    setEditCategory(task.category ?? '')
    setEditNote(task.note ?? '')
    setEditing(true)
  }

  function cancelEdit() { setEditing(false) }

  function submitEdit() {
    if (!editTitle.trim()) return
    onEdit?.({ title: editTitle.trim(), category: editCategory.trim() || null, note: editNote.trim() || null })
    setEditing(false)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDelete) { onDelete?.() } else { setConfirmDelete(true) }
  }

  async function handlePin(e: React.MouseEvent) {
    e.stopPropagation()
    if (!defaultProjectId) return
    const content = task.note ? `${task.title}\n${task.note}` : task.title
    try {
      const res = await window.agentHub?.workspaceMemory?.pin(defaultProjectId, content)
      if (!res) return
      if (res.success) {
        setPinned(true)
        if (pinTimerRef.current) clearTimeout(pinTimerRef.current)
        pinTimerRef.current = setTimeout(() => setPinned(false), 2000)
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
          placeholder="Category..."
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
          placeholder="Note..."
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
        className="card bg-base-100 border border-base-300 shadow-sm group hover:border-base-content/20 transition-colors"
        style={repoGlowColor ? { borderLeftColor: repoGlowColor, borderLeftWidth: 3 } : undefined}
      >
        {/* Drag handle strip — only draggable element; does not trigger hover popover */}
        <div
          data-testid="drag-handle"
          draggable
          onDragStart={handleDragStart}
          className="flex items-center justify-center h-4 border-b border-base-300/50 cursor-grab active:cursor-grabbing hover:bg-base-200/60 transition-colors"
        >
          <GripHorizontal size={14} className="text-base-content/20" />
        </div>

        {/* Card body — hover triggers popover */}
        <div
          data-testid="card-body"
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={() => { handleCardMouseLeave(); setConfirmDelete(false) }}
          className="px-3 py-2 flex flex-col gap-2"
        >
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</span>
            <span
              className={`badge badge-xs shrink-0 ${priorityClass} ${onPriorityChange ? 'cursor-pointer hover:opacity-70' : ''}`}
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

          {/* Sprint label */}
          {task.sprintName && (
            <span className="text-[10px] text-base-content/40 truncate max-w-[90px]">{task.sprintName}</span>
          )}

          {/* Footer */}
          <div className="flex items-center gap-1.5">
            {orchestratorPhase && (
              <span
                className={`badge badge-xs text-[10px] ${PHASE_STATUS_CLASS[orchestratorPhase.status]}`}
                title={`${orchestratorPhase.phase}: ${orchestratorPhase.status}`}
              >
                {PHASE_ICON[orchestratorPhase.phase]} {orchestratorPhase.phase}
              </span>
            )}
            {blockedByCount > 0 ? (
              unresolvedBlockerCount > 0 ? (
                <span
                  className="text-[10px] text-warning truncate max-w-[60px]"
                  title={`${unresolvedBlockerCount} blocker${unresolvedBlockerCount > 1 ? 's' : ''} not done — run sequentially`}
                >
                  ⚠ seq·{unresolvedBlockerCount}
                </span>
              ) : (
                <span
                  className="text-[10px] text-success"
                  title="All blockers done — safe to run in parallel"
                >
                  ✓ par
                </span>
              )
            ) : null}
            {task.category && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORY_DOT_COLOR[task.category] ?? DEFAULT_DOT_COLOR }}
                title={CATEGORY_LABEL[task.category] ?? task.category}
              />
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
            {task.note && <FileText size={10} className="text-base-content/40" />}
            <span className="text-[10px] text-base-content/35 ml-auto">{STATUS_LABEL[task.status]}</span>
            {onEdit && (
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 text-base-content/40 hover:text-base-content"
                title="Edit task"
                onMouseEnter={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); startEdit() }}
              >
                <Pencil size={12} />
              </button>
            )}
            {onDispatch && (
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 text-warning/60 hover:text-warning"
                title="Dispatch to agent"
                onMouseEnter={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDispatch() }}
              >
                <Zap size={12} />
              </button>
            )}
            {onAutoPipeline && (
              <button
                className={`opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 ${isOrchestratorActive ? 'btn-disabled opacity-40' : 'text-primary/60 hover:text-primary'}`}
                title={isOrchestratorActive ? 'Orchestrator already active' : 'Run 5-phase pipeline'}
                onMouseEnter={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isOrchestratorActive) onAutoPipeline()
                }}
              >
                <Rocket size={12} />
              </button>
            )}
            {onDelete && (
              <button
                className={`opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 ${confirmDelete ? 'text-error' : 'text-base-content/40 hover:text-error'}`}
                title={confirmDelete ? 'Click again to confirm' : 'Delete task'}
                onMouseEnter={(e) => e.stopPropagation()}
                onClick={handleDeleteClick}
              >
                {confirmDelete ? <Check size={12} /> : <X size={12} />}
              </button>
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
                {pinned ? <Check size={12} /> : <Pin size={12} />}
              </button>
            )}
          </div>
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
          phaseHistory={phaseHistory}
        />
      )}
    </>
  )
}
