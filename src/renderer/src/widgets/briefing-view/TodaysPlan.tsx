import { useState, useCallback } from 'react'
import type { TaskItem, TaskPriority, CreateTaskInput } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'
import { useTaskStore } from '@renderer/stores/task-store'

interface TodaysPlanProps {
  repos: RepoConfig[]
  onLaunchTask?: (task: TaskItem) => void
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  1: 'bg-error text-error-content',
  2: 'bg-warning text-warning-content',
  3: 'bg-base-content/20 text-base-content/70'
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3'
}

function TodaysPlan({ repos, onLaunchTask }: TodaysPlanProps): React.JSX.Element {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTaskRemote = useTaskStore((s) => s.updateTaskRemote)
  const createTask = useTaskStore((s) => s.createTask)
  const [dragOver, setDragOver] = useState(false)
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskRepoId, setNewTaskRepoId] = useState(repos[0]?.id ?? '')

  const todayTasks = tasks.filter((t) => t.status === 'today')

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const data = e.dataTransfer.getData('application/agenthub-task')
      if (!data) return

      try {
        const task = JSON.parse(data) as TaskItem
        await updateTaskRemote(task.id, { status: 'today' })
      } catch {
        // Invalid drag data
      }
    },
    [updateTaskRemote]
  )

  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !newTaskRepoId) return
    const input: CreateTaskInput = {
      repoId: newTaskRepoId,
      title: newTaskTitle.trim(),
      status: 'today'
    }
    await createTask(input)
    setNewTaskTitle('')
    setShowNewTaskForm(false)
  }, [newTaskTitle, newTaskRepoId, createTask])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleCreateTask()
      }
      if (e.key === 'Escape') {
        setShowNewTaskForm(false)
        setNewTaskTitle('')
      }
    },
    [handleCreateTask]
  )

  return (
    <div data-testid="todays-plan" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
          Today's Plan
        </h3>
        <button
          data-testid="new-task-btn"
          onClick={() => setShowNewTaskForm(true)}
          className="btn-lcars text-[10px] px-3 py-1"
        >
          + New Task
        </button>
      </div>

      <div
        data-testid="todays-plan-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`panel-glass min-h-[80px] transition-all ${
          dragOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''
        }`}
      >
        {todayTasks.length === 0 && !showNewTaskForm && (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-base-content/40">
              Drag tasks from Backlog or click + New Task
            </p>
          </div>
        )}

        {todayTasks.map((task) => (
          <div
            key={task.id}
            data-testid={`today-task-${task.id}`}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-base-content/5 last:border-b-0 hover:bg-base-content/5 transition-colors"
          >
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_COLORS[task.priority]}`}
            >
              {PRIORITY_LABELS[task.priority]}
            </span>
            <span className="text-sm flex-1 truncate">{task.title}</span>
            {onLaunchTask && (
              <button
                data-testid={`launch-task-${task.id}`}
                onClick={() => onLaunchTask(task)}
                className="btn-lcars text-[10px] px-2.5 py-1"
              >
                Launch
              </button>
            )}
          </div>
        ))}

        {showNewTaskForm && (
          <div data-testid="new-task-form" className="flex items-center gap-2 px-4 py-2.5 border-t border-base-content/5">
            <input
              data-testid="new-task-input"
              type="text"
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/30"
            />
            <select
              data-testid="new-task-repo-select"
              value={newTaskRepoId}
              onChange={(e) => setNewTaskRepoId(e.target.value)}
              className="bg-transparent text-xs text-base-content/60 outline-none"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              data-testid="new-task-submit"
              onClick={handleCreateTask}
              className="btn-lcars text-[10px] px-2.5 py-1 btn-primary"
            >
              Add
            </button>
            <button
              data-testid="new-task-cancel"
              onClick={() => {
                setShowNewTaskForm(false)
                setNewTaskTitle('')
              }}
              className="btn-lcars text-[10px] px-2.5 py-1"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TodaysPlan
