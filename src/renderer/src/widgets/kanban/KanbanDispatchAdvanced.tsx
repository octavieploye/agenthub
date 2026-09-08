import { useState } from 'react'
import type { AgentState } from '@shared/types/agent.types'

const ROLES = ['dev-backend', 'dev-frontend', 'dev-integration']

interface KanbanDispatchAdvancedProps {
  recommendations: string[]
  agents: Map<string, AgentState>
  activeAgentCount: number
  spawnCount: number
  teamName: string
  onTeamNameChange: (v: string) => void
  selectedRoles: Set<string>
  onSelectedRolesChange: (roles: Set<string>) => void
}

export function KanbanDispatchAdvanced({
  recommendations,
  agents,
  activeAgentCount,
  spawnCount,
  teamName,
  onTeamNameChange,
  selectedRoles,
  onSelectedRolesChange,
}: KanbanDispatchAdvancedProps) {
  const [recsOpen, setRecsOpen] = useState(true)
  const [teamOpen, setTeamOpen] = useState(false)

  const activeAgents = Array.from(agents.values()).filter(
    (a) => a.status !== 'completed' && a.status !== 'interrupted'
  )
  const wouldExceed = activeAgentCount + selectedRoles.size + spawnCount > 5

  return (
    <>
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
              {recommendations.map((tip) => (
                <li key={tip} className="text-xs text-base-content/60 flex gap-1.5">
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
                onChange={(e) => onTeamNameChange(e.target.value)}
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
                      const next = new Set(selectedRoles)
                      e.target.checked ? next.add(role) : next.delete(role)
                      onSelectedRolesChange(next)
                    }}
                  />
                  <span className="font-mono">{role}</span>
                </label>
              ))}
            </div>
            {wouldExceed && (
              <div className="text-xs text-warning bg-warning/10 rounded-lg p-2 flex flex-col gap-1">
                <span>{activeAgentCount} active + {selectedRoles.size + spawnCount} to spawn exceeds 5 active agents. You can still dispatch.</span>
                {activeAgents.map((a) => (
                  <span key={a.id} className="text-[10px] text-base-content/50 truncate pl-2">
                    <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: a.color }} />
                    {a.name} — {a.taskDescription || a.status}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Capacity warning — shown outside team section so it's always visible */}
      {wouldExceed && !teamOpen && (
        <div className="text-xs text-warning bg-warning/10 rounded-lg p-2 flex flex-col gap-1">
          <span>{activeAgentCount} active + {selectedRoles.size + spawnCount} to spawn exceeds 5 active agents. You can still dispatch.</span>
          {activeAgents.map((a) => (
            <span key={a.id} className="text-[10px] text-base-content/50 truncate pl-2">
              <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: a.color }} />
              {a.name} — {a.taskDescription || a.status}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
