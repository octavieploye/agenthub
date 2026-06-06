import React from 'react'
import type { SBARHandoff } from '@shared/types/recovery.types'
import type { TaskItem } from '@shared/types/task.types'
import type { BugEntry } from '@shared/types/bug-radar.types'

interface SessionReviewPanelProps {
  sbar: SBARHandoff | null
  todos: TaskItem[]
  bugs: BugEntry[]
}

function SessionReviewPanel({ sbar, todos, bugs }: SessionReviewPanelProps): React.JSX.Element {
  const openTodos = todos.filter((t) => t.status !== 'completed' && t.status !== 'tested')
  const openBugs = bugs.filter((b) => !b.resolvedAt)

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full" data-testid="session-review-panel">

      {/* SBAR Summary */}
      <div className="panel-glass p-3 space-y-2">
        <h3 className="text-xs font-semibold text-warning uppercase tracking-wider">Last Session Summary</h3>
        {sbar ? (
          <div className="space-y-1 text-xs text-base-content/70">
            <div data-testid="sbar-situation">
              <span className="font-semibold text-base-content/90">Situation: </span>{sbar.situation}
            </div>
            <div data-testid="sbar-background">
              <span className="font-semibold text-base-content/90">Background: </span>{sbar.background}
            </div>
            <div data-testid="sbar-assessment">
              <span className="font-semibold text-base-content/90">Assessment: </span>{sbar.assessment}
            </div>
            <div data-testid="sbar-recommendation" className="text-info">
              <span className="font-semibold text-base-content/90">Recommendation: </span>{sbar.recommendation}
            </div>
          </div>
        ) : (
          <p className="text-xs text-base-content/40" data-testid="sbar-empty">No session summary available.</p>
        )}
      </div>

      {/* Open Todos */}
      <div className="panel-glass p-3 space-y-2">
        <h3 className="text-xs font-semibold text-info uppercase tracking-wider">
          Open Todos ({openTodos.length})
        </h3>
        {openTodos.length === 0 ? (
          <p className="text-xs text-base-content/40">No open todos.</p>
        ) : (
          <ul className="space-y-1">
            {openTodos.map((todo) => (
              <li
                key={todo.id}
                data-testid={`review-todo-${todo.id}`}
                className="flex items-start gap-2 text-xs text-base-content/70"
              >
                <span className={`badge badge-xs mt-0.5 ${todo.priority === 1 ? 'badge-error' : todo.priority === 2 ? 'badge-warning' : 'badge-info'}`}>
                  P{todo.priority}
                </span>
                <span>{todo.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Open Bugs */}
      <div className="panel-glass p-3 space-y-2">
        <h3 className="text-xs font-semibold text-error uppercase tracking-wider">
          Open Bugs ({openBugs.length})
        </h3>
        {openBugs.length === 0 ? (
          <p className="text-xs text-base-content/40">No open bugs.</p>
        ) : (
          <ul className="space-y-1">
            {openBugs.map((bug) => (
              <li
                key={bug.id}
                data-testid={`review-bug-${bug.id}`}
                className="flex items-start gap-2 text-xs text-base-content/70"
              >
                <span className={`badge badge-xs mt-0.5 ${bug.severity === 'critical' ? 'badge-error' : bug.severity === 'high' ? 'badge-warning' : 'badge-info'}`}>
                  {bug.severity}
                </span>
                <span>{bug.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}

export default SessionReviewPanel
