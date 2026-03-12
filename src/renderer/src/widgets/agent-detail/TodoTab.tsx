import { useState, useEffect, useCallback, useRef } from 'react'
import { useTaskStore } from '../../stores/task-store'
import type { AgentState } from '@shared/types/agent.types'
import type { TaskItem, TaskPriority, TaskStatus } from '@shared/types/task.types'
import { VoiceInputButton } from '../voice-input-button/VoiceInputButton'

interface TodoTabProps {
  agent: AgentState
  onSpawnWithTask?: (task: string) => void
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  1: 'badge-error',
  2: 'badge-warning',
  3: 'badge-info'
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3'
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  in_progress: 'badge-primary',
  today: 'badge-accent',
  backlog: 'badge-ghost',
  completed: 'badge-success',
  tested: 'badge-success',
  interrupted: 'badge-warning'
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0,
  today: 1,
  backlog: 2,
  completed: 3,
  tested: 4,
  interrupted: 5
}

function groupAndSort(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (orderDiff !== 0) return orderDiff
    return a.priority - b.priority
  })
}

export default function TodoTab({ agent, onSpawnWithTask }: TodoTabProps): React.JSX.Element {

  const tasks = useTaskStore((s) => s.tasks)
  const fetchTasksOnce = useTaskStore((s) => s.fetchTasksOnce)
  const createTask = useTaskStore((s) => s.createTask)
  const updateTaskRemote = useTaskStore((s) => s.updateTaskRemote)
  const deleteTask = useTaskStore((s) => s.deleteTask)

  const [newTitle, setNewTitle] = useState('')
  const todoInputRef = useRef<HTMLInputElement>(null)
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>(2)

  const [sentTaskId, setSentTaskId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPriority, setEditPriority] = useState<TaskPriority>(2)

  useEffect(() => {
    fetchTasksOnce()
  }, [fetchTasksOnce])

  const repoTasks = groupAndSort(tasks.filter((t) => t.repoId === agent.repoId))

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim()
    if (!title) return
    await createTask({
      repoId: agent.repoId,
      title,
      description: newDescription.trim() || undefined,
      priority: newPriority
    })
    setNewTitle('')
    setNewDescription('')
    setNewPriority(2)
  }, [newTitle, newDescription, newPriority, agent.repoId, createTask])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd]
  )

  const handleComplete = useCallback(
    (id: string) => {
      updateTaskRemote(id, { status: 'completed' })
    },
    [updateTaskRemote]
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteTask(id)
    },
    [deleteTask]
  )

  const handleSpawn = useCallback(
    (task: TaskItem) => {
      const prompt = task.description
        ? `${task.title}: ${task.description}`
        : task.title
      onSpawnWithTask?.(prompt)
      setSentTaskId(task.id)
      setTimeout(() => setSentTaskId(null), 1500)
    },
    [onSpawnWithTask]
  )

  const startEdit = useCallback((task: TaskItem) => {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditDescription(task.description || '')
    setEditPriority(task.priority)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditTitle('')
    setEditDescription('')
    setEditPriority(2)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    const title = editTitle.trim()
    if (!title) return
    await updateTaskRemote(editingId, {
      title,
      description: editDescription.trim() || undefined,
      priority: editPriority
    })
    cancelEdit()
  }, [editingId, editTitle, editDescription, editPriority, updateTaskRemote, cancelEdit])

  const agentColor = agent.color || '#3B82F6'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        {repoTasks.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-base-content/40">No tasks for this repo</p>
          </div>
        )}

        {repoTasks.map((task) => (
          <div
            key={task.id}
            className={`px-3 py-2 border-b border-base-content/5 last:border-b-0 hover:bg-base-content/5 transition-colors ${
              task.status === 'completed' || task.status === 'tested' ? 'opacity-40' : ''
            }`}
          >
            {editingId === task.id ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input input-bordered input-sm w-full bg-base-100/50 text-sm text-base-content border-base-content/10 focus:outline-none"
                  style={{ borderColor: `${agentColor}40`, focusBorderColor: agentColor }}
                  autoFocus
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="textarea textarea-bordered textarea-sm w-full bg-base-100/50 text-xs text-base-content border-base-content/10 focus:outline-none resize-none"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value) as TaskPriority)}
                    className="select select-bordered select-sm bg-base-100/50 text-xs border-base-content/10"
                  >
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={3}>P3</option>
                  </select>
                  <div className="flex-1" />
                  <button
                    onClick={cancelEdit}
                    className="btn-lcars text-[10px] px-2 py-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="btn-lcars text-[10px] px-2 py-0.5 text-white"
                    style={{ backgroundColor: agentColor }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span className={`badge badge-xs mt-1 ${PRIORITY_BADGE[task.priority]}`}>
                  {PRIORITY_LABEL[task.priority]}
                </span>

                <div className="flex-1 min-w-0">
                  <span className="text-sm break-words">{task.title}</span>
                  {task.description && (
                    <p className="text-xs text-base-content/50 break-words mt-0.5">{task.description}</p>
                  )}
                </div>

                <span className={`badge badge-xs shrink-0 mt-1 ${STATUS_BADGE[task.status]}`}>
                  {task.status.replace('_', ' ')}
                </span>

                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {task.status !== 'completed' && task.status !== 'tested' && (
                    <>
                      <button
                        onClick={() => handleSpawn(task)}
                        className="btn btn-ghost btn-xs active:scale-90 relative overflow-hidden transition-all duration-200 ease-in-out text-primary/70 hover:text-primary hover:brightness-125"
                        title="Launch agent with this task"
                        style={{ minWidth: '2.5rem' }}
                      >
                        <span
                          className="inline-block text-primary/70"
                          style={{
                            transition: 'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)',
                            opacity: sentTaskId === task.id ? 0 : 1
                          }}
                        >
                          Play
                        </span>
                        <span
                          className="absolute inset-0 flex items-center justify-center text-success"
                          style={{
                            transition: 'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)',
                            opacity: sentTaskId === task.id ? 1 : 0
                          }}
                        >
                          Sent!
                        </span>
                      </button>
                      <button
                        onClick={() => handleComplete(task.id)}
                        className="btn btn-ghost btn-xs text-success/70 hover:text-success hover:brightness-125 active:scale-90 transition-all duration-200 ease-in-out"
                        title="Mark completed"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => startEdit(task)}
                        className="btn btn-ghost btn-xs text-base-content/40 hover:text-base-content/70 active:scale-90 transition-all duration-200 ease-in-out"
                        title="Edit task"
                      >
                        Edit
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="btn btn-ghost btn-xs text-error/50 hover:text-error hover:brightness-110 active:scale-90 transition-all duration-200 ease-in-out"
                    title="Delete task"
                  >
                    Del
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-base-content/10 p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={todoInputRef}
            type="text"
            placeholder="Task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input input-bordered input-sm flex-1 bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:outline-none"
            style={{ borderColor: `${agentColor}30` }}
          />
          <VoiceInputButton inputRef={todoInputRef} />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(Number(e.target.value) as TaskPriority)}
            className="select select-bordered select-sm bg-base-100/50 text-xs border-base-content/10"
          >
            <option value={1}>P1</option>
            <option value={2}>P2</option>
            <option value={3}>P3</option>
          </select>
          <button
            onClick={handleAdd}
            className="btn-lcars text-[10px] px-3 py-1 text-white"
            style={{ backgroundColor: agentColor }}
          >
            Add
          </button>
        </div>
        <textarea
          placeholder="Description (optional)..."
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          rows={2}
          className="textarea textarea-bordered textarea-sm w-full bg-base-100/50 text-xs text-base-content placeholder:text-base-content/30 border-base-content/10 focus:outline-none resize-none"
          style={{ borderColor: `${agentColor}30` }}
        />
      </div>
    </div>
  )
}
