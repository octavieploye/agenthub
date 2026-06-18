import { useState, useEffect } from 'react'
import { useTaskStore } from '../../stores/task-store'
import { useAgentStore } from '../../stores/agent-store'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import type { TaskStatus } from '@shared/types/task.types'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'today', label: 'Today' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Done' },
  { status: 'tested', label: 'Tested' },
  { status: 'interrupted', label: 'Interrupted' }
]

interface KanbanBoardProps {
  defaultAgentFilter?: string
}

export function KanbanBoard({ defaultAgentFilter }: KanbanBoardProps) {
  const { tasks, fetchTasksOnce, updateTaskRemote } = useTaskStore()
  const agents = useAgentStore((s) => s.agents)
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set())
  const [agentFilter, setAgentFilter] = useState<string | null>(defaultAgentFilter ?? null)

  useEffect(() => { fetchTasksOnce() }, [fetchTasksOnce])

  function toggleCollapse(status: TaskStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(status) ? next.delete(status) : next.add(status)
      return next
    })
  }

  function handleCardDrop(taskId: string, toStatus: TaskStatus) {
    updateTaskRemote(taskId, { status: toStatus })
  }

  const agentList = Array.from(agents.values())

  function getAgentColor(agentId: string | null): string | undefined {
    if (!agentId) return undefined
    return agents.get(agentId)?.color
  }

  function getAgentName(agentId: string | null): string | undefined {
    if (!agentId) return undefined
    return agents.get(agentId)?.name
  }

  const filtered = agentFilter
    ? tasks.filter((t) => t.agentId === agentFilter)
    : tasks

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-base-300">
        <h2 className="text-lg font-bold">Kanban Board</h2>
        <select
          className="select select-sm select-bordered"
          value={agentFilter ?? ''}
          onChange={(e) => setAgentFilter(e.target.value || null)}
        >
          <option value="">All agents</option>
          {agentList.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 p-4 overflow-x-auto flex-1">
        {COLUMNS.map(({ status, label }) => {
          const columnTasks = filtered
            .filter((t) => t.status === status)
            .sort((a, b) => a.position - b.position)

          return (
            <KanbanColumn
              key={status}
              status={status}
              label={label}
              tasks={columnTasks}
              collapsed={collapsed.has(status)}
              onToggleCollapse={() => toggleCollapse(status)}
              onCardDrop={handleCardDrop}
            >
              {columnTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  agentColor={getAgentColor(task.agentId)}
                  agentName={getAgentName(task.agentId)}
                />
              ))}
            </KanbanColumn>
          )
        })}
      </div>
    </div>
  )
}
