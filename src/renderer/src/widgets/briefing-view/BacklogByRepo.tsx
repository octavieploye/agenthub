import { useState } from 'react'
import type { TaskItem, TaskPriority } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'
import { useTaskStore, buildBacklogGroups } from '@renderer/stores/task-store'

interface BacklogByRepoProps {
  repos: RepoConfig[]
  onAddRepo: () => void
  onDragStart?: (task: TaskItem) => void
  onCreateTask?: (repoId: string) => void
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

function BacklogByRepo({ repos, onAddRepo, onDragStart, onCreateTask }: BacklogByRepoProps): React.JSX.Element {
  const tasks = useTaskStore((s) => s.tasks)
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set())

  const groups = buildBacklogGroups(tasks, repos)

  const toggleRepo = (repoId: string): void => {
    setExpandedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(repoId)) {
        next.delete(repoId)
      } else {
        next.add(repoId)
      }
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent, task: TaskItem): void => {
    e.dataTransfer.setData('application/agenthub-task', JSON.stringify(task))
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(task)
  }

  return (
    <div data-testid="backlog-by-repo" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
          Backlog by Repo
        </h3>
        <button
          data-testid="add-repo-btn"
          onClick={onAddRepo}
          className="btn-lcars text-[10px] px-3 py-1"
        >
          + Add Repo
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="panel-glass p-6 text-center">
          <p className="text-sm text-base-content/50">No backlog tasks. Create a task to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <div key={group.repoId} data-testid={`backlog-group-${group.repoId}`} className="panel-glass overflow-hidden">
              <button
                data-testid={`backlog-toggle-${group.repoId}`}
                onClick={() => toggleRepo(group.repoId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-base-content/5 transition-colors text-left"
              >
                <span className="text-xs text-base-content/40">
                  {expandedRepos.has(group.repoId) ? '▼' : '▶'}
                </span>
                <span className="text-sm font-medium flex-1">{group.repoName}</span>
                <div className="flex gap-1.5">
                  {group.priorityCounts.p1 > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-error/20 text-error font-medium">
                      P1:{group.priorityCounts.p1}
                    </span>
                  )}
                  {group.priorityCounts.p2 > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
                      P2:{group.priorityCounts.p2}
                    </span>
                  )}
                  {group.priorityCounts.p3 > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-base-content/10 text-base-content/50 font-medium">
                      P3:{group.priorityCounts.p3}
                    </span>
                  )}
                </div>
              </button>

              {expandedRepos.has(group.repoId) && (
                <div data-testid={`backlog-tasks-${group.repoId}`} className="border-t border-base-content/5">
                  {group.tasks.map((task) => (
                    <div
                      key={task.id}
                      data-testid={`backlog-task-${task.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-base-content/5 transition-colors cursor-grab active:cursor-grabbing border-b border-base-content/5 last:border-b-0"
                    >
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_COLORS[task.priority]}`}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      <span className="text-sm flex-1 truncate">{task.title}</span>
                    </div>
                  ))}
                  {onCreateTask && (
                    <button
                      data-testid={`add-task-btn-${group.repoId}`}
                      onClick={() => onCreateTask(group.repoId)}
                      className="w-full text-left px-4 py-2 text-xs text-base-content/40 hover:text-base-content/60 hover:bg-base-content/5 transition-colors"
                    >
                      + New Task
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BacklogByRepo
