import { useState, useEffect } from 'react'
import { useTaskStore } from '../../stores/task-store'
import { useAgentStore } from '../../stores/agent-store'
import { useProjectStore } from '../../stores/project-store'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { ProjectManagerModal } from './ProjectManagerModal'
import type { TaskItem, TaskStatus, TaskCategory, TaskPriority } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'

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
  const { tasks, fetchTasks, fetchTasksOnce, updateTaskRemote, createTask, deleteTask } = useTaskStore()
  const agents = useAgentStore((s) => s.agents)
  const { projects, selectedProjectId, selectProject, fetchProjects } = useProjectStore()
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set())
  const [agentFilter, setAgentFilter] = useState<string | null>(defaultAgentFilter ?? null)
  const [repos, setRepos] = useState<RepoConfig[]>([])
  const [projectModalOpen, setProjectModalOpen] = useState(false)

  useEffect(() => {
    fetchTasksOnce()
    fetchProjects()
    window.agentHub.db.getRepos().then((res) => { if (res.success) setRepos(res.data) })
  }, [fetchTasksOnce, fetchProjects])

  useEffect(() => {
    return window.agentHub.on.tasksUpdated(() => { fetchTasks() })
  }, [fetchTasks])

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

  async function handleAddTask(status: TaskStatus, title: string, repoId: string, category: TaskCategory | null, priority: TaskPriority, note: string | null) {
    await createTask({ repoId, title, status, category: category ?? undefined, priority,
      projectId: selectedProjectId ?? undefined,
      note: note ?? undefined
    })
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

  function getRepoGlowColor(repoId: string): string | undefined {
    return repos.find((r) => r.id === repoId)?.glowColor
  }

  function renderSections(columnTasks: TaskItem[]) {
    const grouped = columnTasks.reduce<Record<string, TaskItem[]>>((acc, task) => {
      const section = task.epicName ?? 'Unsorted'
      if (!acc[section]) acc[section] = []
      acc[section].push(task)
      return acc
    }, {})

    const sections = Object.keys(grouped).sort((a, b) =>
      a === 'Unsorted' ? 1 : b === 'Unsorted' ? -1 : a.localeCompare(b)
    )

    return sections.map((section) => {
      const sectionTasks = grouped[section]
      const milestoneDate = sectionTasks.map((t) => t.sectionTargetDate).find((d) => d != null) ?? null

      if (!milestoneDate) {
        return (
          <div key={section}>
            <div className="text-xs text-base-content/40 font-semibold px-1 pt-2 pb-1 uppercase tracking-wide">
              {section}
            </div>
            {sectionTasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                agentColor={getAgentColor(task.agentId)}
                agentName={getAgentName(task.agentId)}
                repoGlowColor={getRepoGlowColor(task.repoId)}
                onPriorityChange={(p) => updateTaskRemote(task.id, { priority: p })}
                onEdit={(input) => updateTaskRemote(task.id, input)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        )
      }

      const doneCount = sectionTasks.filter(
        (t) => t.status === 'completed' || t.status === 'tested'
      ).length
      const total = sectionTasks.length
      const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
      const parsedDate = new Date(milestoneDate)
      const isPast = parsedDate < new Date() && pct < 100
      const dateLabel = parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

      return (
        <div key={section}>
          <div className="px-1 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">
                {section}
              </span>
              <span className="text-[10px] text-base-content/40">
                {doneCount}/{total}
              </span>
              <span className={`text-[10px] ${isPast ? 'text-error' : 'text-base-content/40'}`}>
                · Due {dateLabel}
              </span>
            </div>
            <progress
              className="progress progress-primary w-full h-1 mt-0.5"
              value={pct}
              max={100}
            />
          </div>
          {sectionTasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              agentColor={getAgentColor(task.agentId)}
              agentName={getAgentName(task.agentId)}
              repoGlowColor={getRepoGlowColor(task.repoId)}
              onPriorityChange={(p) => updateTaskRemote(task.id, { priority: p })}
              onEdit={(input) => updateTaskRemote(task.id, input)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </div>
      )
    })
  }

  const filtered = (() => {
    let result = tasks
    if (agentFilter) result = result.filter((t) => t.agentId === agentFilter)
    if (selectedProjectId) result = result.filter((t) => t.projectId === selectedProjectId)
    return result
  })()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-base-300">
        <h2 className="text-lg font-bold">Kanban Board</h2>
        <select
          className="select select-sm select-bordered"
          value={selectedProjectId ?? ''}
          onChange={(e) => selectProject(e.target.value || null)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setProjectModalOpen(true)}
          title="Manage projects"
        >
          ⚙
        </button>
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
              repos={repos}
              onToggleCollapse={() => toggleCollapse(status)}
              onCardDrop={handleCardDrop}
              onAddTask={(title, repoId, cat, priority, n) => handleAddTask(status, title, repoId, cat, priority, n)}
            >
              {renderSections(columnTasks)}
            </KanbanColumn>
          )
        })}
      </div>

      <ProjectManagerModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
      />
    </div>
  )
}
