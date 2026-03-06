import { useState, useEffect, useCallback } from 'react'
import { useTaskStore } from '../../stores/task-store'
import type { AgentState } from '@shared/types/agent.types'
import type { TaskItem, TaskPriority, TaskStatus } from '@shared/types/task.types'

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
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const createTask = useTaskStore((s) => s.createTask)
  const updateTaskRemote = useTaskStore((s) => s.updateTaskRemote)
  const deleteTask = useTaskStore((s) => s.deleteTask)

  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>(2)

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const repoTasks = groupAndSort(tasks.filter((t) => t.repoId === agent.repoId))

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim()
    if (!title) return
    await createTask({
      repoId: agent.repoId,
      title,
      priority: newPriority
    })
    setNewTitle('')
    setNewPriority(2)
  }, [newTitle, newPriority, agent.repoId, createTask])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
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
    },
    [onSpawnWithTask]
  )

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
            className={`flex items-center gap-2 px-3 py-2 border-b border-base-content/5 last:border-b-0 hover:bg-base-content/5 transition-colors ${
              task.status === 'completed' || task.status === 'tested' ? 'opacity-40' : ''
            }`}
          >
            <span className={`badge badge-xs ${PRIORITY_BADGE[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>

            <span className="text-sm flex-1 truncate">{task.title}</span>

            <span className={`badge badge-xs ${STATUS_BADGE[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {task.status !== 'completed' && task.status !== 'tested' && (
                <>
                  <button
                    onClick={() => handleSpawn(task)}
                    className="btn-lcars text-[10px] px-2 py-0.5"
                    title="Launch agent with this task"
                  >
                    Play
                  </button>
                  <button
                    onClick={() => handleComplete(task.id)}
                    className="btn btn-ghost btn-xs text-success"
                    title="Mark completed"
                  >
                    Done
                  </button>
                </>
              )}
              <button
                onClick={() => handleDelete(task.id)}
                className="btn btn-ghost btn-xs text-error/60"
                title="Delete task"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-base-content/10 p-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="New task title..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input input-bordered input-sm flex-1 bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:border-primary/40 focus:outline-none"
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(Number(e.target.value) as TaskPriority)}
          className="select select-bordered select-sm bg-base-100/50 text-xs border-base-content/10"
        >
          <option value={1}>P1</option>
          <option value={2}>P2</option>
          <option value={3}>P3</option>
        </select>
        <button onClick={handleAdd} className="btn-lcars text-[10px] px-3 py-1">
          Add
        </button>
      </div>
    </div>
  )
}
