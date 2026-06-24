import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskItem } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'
import { useAgentStore } from '../../stores/agent-store'
import { useProjectStore } from '../../stores/project-store'

const PRIORITY_TEXT: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }

const ROLES = ['dev-backend', 'dev-frontend', 'dev-integration']

type DispatchMode = 'existing' | 'spawn'

function buildPrompt(task: TaskItem, projectName: string | undefined): string {
  const lines = [
    `Task: ${task.title}`,
    `Priority: ${PRIORITY_TEXT[task.priority] ?? task.priority}`,
    `Sprint: ${task.sprintName ?? '—'}`,
    `Epic: ${task.epicName ?? '—'}`,
    `Category: ${task.category ?? '—'}`,
    `Project: ${projectName ?? '—'}`,
    '',
    task.description ?? '',
  ]
  return lines.join('\n').trimEnd()
}

function buildRecommendations(task: TaskItem, agentStatus: string | undefined): string[] {
  const tips: string[] = []
  if (task.priority === 1) {
    tips.push('High priority — consider asking the agent to confirm scope before starting.')
  }
  if (!task.description?.trim()) {
    tips.push('Description is empty — add detail to the prompt above for better results.')
  }
  if (!task.sprintName && !task.epicName) {
    tips.push('No sprint or epic set — agent may lack context on timeline.')
  }
  if (agentStatus && agentStatus !== 'idle' && agentStatus !== 'completed') {
    tips.push(`Agent is currently ${agentStatus} — dispatching will queue behind current work.`)
  }
  return tips
}

function generateAgentName(title: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const short = title.length > 40 ? title.slice(0, 40).trimEnd() : title
  return `${short} — ${date}`
}

function resolveCwd(
  task: TaskItem,
  projects: { id: string; path: string | null }[],
  repos: RepoConfig[]
): string {
  const project = projects.find((p) => p.id === task.projectId)
  if (project?.path) return project.path
  const repo = repos.find((r) => r.id === task.repoId)
  return repo?.path ?? '/tmp'
}

interface KanbanDispatchModalProps {
  task: TaskItem
  agentId: string | null
  onClose: () => void
  repos: RepoConfig[]
}

export function KanbanDispatchModal({ task, agentId, onClose, repos }: KanbanDispatchModalProps) {
  const agents = useAgentStore((s) => s.agents)
  const { projects } = useProjectStore()

  const agent = agentId ? agents.get(agentId) : undefined
  const isAgentLive = agent && agent.status !== 'completed' && agent.status !== 'interrupted'
  const project = projects.find((p) => p.id === task.projectId)

  const [mode, setMode] = useState<DispatchMode>(
    agentId && isAgentLive ? 'existing' : 'spawn'
  )
  const [spawnName, setSpawnName] = useState(() => generateAgentName(task.title))
  const [prompt, setPrompt] = useState(() => buildPrompt(task, project?.name))
  const [isDispatching, setIsDispatching] = useState(false)

  const [recsOpen, setRecsOpen] = useState(true)
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamName, setTeamName] = useState('dev-stack')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())

  const activeAgentCount = Array.from(agents.values()).filter(
    (a) => a.status !== 'completed' && a.status !== 'interrupted'
  ).length
  const spawnCount = mode === 'spawn' ? 1 : 0
  const wouldExceed = activeAgentCount + selectedRoles.size + spawnCount > 3

  const recommendations = buildRecommendations(task, agent?.status)

  async function handleDispatch() {
    setIsDispatching(true)

    let targetAgentId = agentId

    if (mode === 'spawn') {
      const cwd = resolveCwd(task, projects, repos)
      const result = await window.agentHub.agents.spawn({
        repoId: task.repoId,
        name: spawnName.trim() || generateAgentName(task.title),
        cwd,
        color: '#6B7280',
        projectId: task.projectId ?? undefined,
      })
      if (result.success && result.data) {
        targetAgentId = result.data.id
        useAgentStore.getState().upsertAgent(result.data)
      } else {
        setIsDispatching(false)
        return
      }
    }

    if (!targetAgentId) {
      setIsDispatching(false)
      return
    }

    if (selectedRoles.size > 0) {
      const existingAgent = agents.get(targetAgentId)
      const spawnCwd = existingAgent?.cwd ?? resolveCwd(task, projects, repos)
      const roles = Array.from(selectedRoles)
      const failedRoles: string[] = []
      for (const role of roles) {
        try {
          const res = await window.agentHub.agents.spawn({
            repoId: task.repoId,
            name: `${teamName}-${role}`,
            cwd: spawnCwd,
            taskDescription: `[${role}] ${task.title}`,
            color: '#6B7280',
            projectId: task.projectId ?? undefined,
          })
          if (!res.success) failedRoles.push(role)
        } catch {
          failedRoles.push(role)
        }
      }
      if (failedRoles.length > 0) {
        console.error('Failed to spawn team roles:', failedRoles)
      }
    }

    window.agentHub.agents.sendInput(targetAgentId, prompt.trim() + '\r')

    try {
      await window.agentHub.tasks.update(task.id, {
        status: 'in_progress',
        agentId: targetAgentId,
      })
    } catch (err) {
      console.error('Failed to update task status after dispatch:', err)
    }

    setIsDispatching(false)
    onClose()
  }

  const content = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-base-200 border border-base-300 rounded-xl shadow-2xl flex flex-col gap-4 p-5 w-[480px] max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Dispatch task</span>
            <span className="text-sm font-semibold truncate max-w-[300px]" title={task.title}>{task.title}</span>
          </div>
          <button
            aria-label="Close dispatch modal"
            className="btn btn-xs btn-ghost shrink-0"
            onClick={onClose}
          >✕</button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-3 bg-base-300/50 rounded-lg p-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer flex-1">
            <input
              type="radio"
              name="dispatch-mode"
              className="radio radio-xs radio-primary"
              aria-label="Spawn new agent"
              checked={mode === 'spawn'}
              onChange={() => setMode('spawn')}
            />
            <span>Spawn new agent</span>
          </label>
          <label className={`flex items-center gap-2 text-xs cursor-pointer flex-1 ${!agentId ? 'opacity-40' : ''}`}>
            <input
              type="radio"
              name="dispatch-mode"
              className="radio radio-xs radio-primary"
              aria-label="Use existing agent"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
              disabled={!agentId}
            />
            <span>Use existing agent</span>
          </label>
        </div>

        {/* Mode-specific UI */}
        {mode === 'spawn' ? (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="spawn-agent-name"
              className="text-xs text-base-content/50 font-medium uppercase tracking-wide"
            >Agent name</label>
            <input
              id="spawn-agent-name"
              aria-label="Agent name"
              className="input input-sm input-bordered w-full"
              value={spawnName}
              onChange={(e) => setSpawnName(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {agent && (
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: agent.color }}
              />
            )}
            <span className="text-sm font-semibold">{agent?.name ?? agentId}</span>
            <span className="text-xs text-base-content/40 ml-auto">{agent?.status}</span>
          </div>
        )}

        <div className="border-t border-base-300" />

        {/* Prompt editor */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="dispatch-prompt"
            className="text-xs text-base-content/50 font-medium uppercase tracking-wide"
          >Prompt</label>
          <textarea
            id="dispatch-prompt"
            aria-label="prompt"
            className="textarea textarea-bordered w-full resize-y font-mono text-xs"
            rows={8}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="flex flex-col gap-1">
            <button
              className="flex items-center gap-1 text-xs text-base-content/50 font-medium uppercase tracking-wide text-left"
              onClick={() => setRecsOpen((o) => !o)}
            >
              <span>{recsOpen ? '▾' : '▸'}</span> Recommendations
            </button>
            {recsOpen && (
              <ul className="flex flex-col gap-1 pl-3">
                {recommendations.map((tip, i) => (
                  <li key={i} className="text-xs text-base-content/60 flex gap-1.5">
                    <span className="text-warning shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Team spawn */}
        <div className="flex flex-col gap-1">
          <button
            className="flex items-center gap-1 text-xs text-base-content/50 font-medium uppercase tracking-wide text-left"
            onClick={() => setTeamOpen((o) => !o)}
          >
            <span>{teamOpen ? '▾' : '▸'}</span> Team spawn
          </button>
          {teamOpen && (
            <div className="flex flex-col gap-2 pl-3 border-l-2 border-base-300">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="team-name"
                  className="text-xs text-base-content/50"
                >Team name</label>
                <input
                  id="team-name"
                  aria-label="Team name"
                  className="input input-xs input-bordered w-full"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="dev-stack"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-base-content/50">Roles to spawn</span>
                {ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      aria-label={role}
                      checked={selectedRoles.has(role)}
                      onChange={(e) => {
                        setSelectedRoles((prev) => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(role) : next.delete(role)
                          return next
                        })
                      }}
                    />
                    <span className="font-mono">{role}</span>
                  </label>
                ))}
              </div>
              {wouldExceed && (
                <div className="text-xs text-warning bg-warning/10 rounded-lg p-2">
                  Adding {selectedRoles.size + spawnCount} agent(s) + current agents exceeds 3 active agents (CLAUDE.md rule).
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-sm btn-primary"
            disabled={!prompt.trim() || isDispatching || wouldExceed}
            onClick={handleDispatch}
          >{isDispatching ? 'Dispatching…' : 'Dispatch'}</button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
