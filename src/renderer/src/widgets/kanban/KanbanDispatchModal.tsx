import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskItem } from '@shared/types/task.types'
import { useAgentStore } from '../../stores/agent-store'
import { useProjectStore } from '../../stores/project-store'

const PRIORITY_TEXT: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }

const ROLES = ['dev-backend', 'dev-frontend', 'dev-integration']

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

interface KanbanDispatchModalProps {
  task: TaskItem
  agentId: string
  onClose: () => void
}

export function KanbanDispatchModal({ task, agentId, onClose }: KanbanDispatchModalProps) {
  const agents = useAgentStore((s) => s.agents)
  const { projects } = useProjectStore()

  const agent = agents.get(agentId)
  const project = projects.find((p) => p.id === task.projectId)

  const [prompt, setPrompt] = useState(() => buildPrompt(task, project?.name))
  const [isDispatching, setIsDispatching] = useState(false)

  const [recsOpen, setRecsOpen] = useState(true)
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamName, setTeamName] = useState('dev-stack')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())

  const activeAgentCount = Array.from(agents.values()).filter(
    (a) => a.status !== 'completed' && a.status !== 'interrupted'
  ).length
  const wouldExceed = activeAgentCount + selectedRoles.size > 3

  const recommendations = buildRecommendations(task, agent?.status)

  async function handleDispatch() {
    setIsDispatching(true)

    if (selectedRoles.size > 0 && agent) {
      const roles = Array.from(selectedRoles)
      for (const role of roles) {
        await window.agentHub.agents.spawn({
          repoId: task.repoId,
          name: `${teamName}-${role}`,
          cwd: agent.cwd,
          taskDescription: `[${role}] ${task.title}`,
          color: '#6B7280',
        })
      }
    }

    window.agentHub.agents.sendInput(agentId, prompt.trim() + '\r')

    await window.agentHub.tasks.update(task.id, {
      status: 'in_progress',
      agentId,
    })

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
          <div className="flex items-center gap-2">
            {agent && (
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: agent.color }}
              />
            )}
            <div className="flex flex-col">
              <span className="text-xs text-base-content/50 uppercase tracking-wide">Dispatch to</span>
              <span className="text-sm font-semibold">{agent?.name ?? agentId}</span>
            </div>
          </div>
          <div className="text-sm text-base-content/60 truncate max-w-[200px]" title={task.title}>
            {task.title}
          </div>
          <button
            aria-label="Close dispatch modal"
            className="btn btn-xs btn-ghost shrink-0"
            onClick={onClose}
          >✕</button>
        </div>

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
                  Adding {selectedRoles.size} role(s) + current agents exceeds 3 active agents (CLAUDE.md rule).
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
            disabled={!prompt.trim() || isDispatching}
            onClick={handleDispatch}
          >{isDispatching ? 'Dispatching…' : 'Dispatch'}</button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
