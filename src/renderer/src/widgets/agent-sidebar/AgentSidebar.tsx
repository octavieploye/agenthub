import type { AgentState } from '@shared/types/agent.types'

interface AgentSidebarProps {
  agents: AgentState[]
  activeAgentId: string | null
  onSelectAgent: (id: string) => void
  onKillAgent: (id: string) => void
  onPauseAgent: (id: string) => void
  onResumeAgent: (id: string) => void
  onSpawnAgent: () => void
  onOpenGuardrails?: (agentId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  spawning: 'bg-info animate-pulse',
  busy: 'bg-success',
  idle: 'bg-base-content/40',
  locked: 'bg-warning animate-breathe',
  completed: 'bg-info',
  looping: 'bg-error animate-urgency-pulse',
  paused: 'bg-amber-400',
  interrupted: 'bg-error',
  tray_running: 'bg-success/50'
}

function AgentSidebar({
  agents,
  activeAgentId,
  onSelectAgent,
  onKillAgent,
  onPauseAgent,
  onResumeAgent,
  onSpawnAgent,
  onOpenGuardrails
}: AgentSidebarProps): React.JSX.Element {
  return (
    <aside className="w-56 shrink-0 panel-glass border-r border-base-content/10 flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-content/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
          Agents
        </span>
        <button
          onClick={onSpawnAgent}
          className="btn btn-xs btn-primary btn-outline rounded-full"
          title="Spawn new agent"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {agents.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-base-content/40">
            No agents running
          </div>
        )}

        {agents.map((agent) => {
          const isActive = agent.id === activeAgentId
          const isRunning = agent.status === 'busy' || agent.status === 'locked'
          const isPaused = agent.status === 'paused'

          return (
            <div
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`mx-1 mb-0.5 px-2 py-2 rounded-lg cursor-pointer transition-all ${
                isActive
                  ? 'panel-glass-active bg-primary/10'
                  : 'hover:bg-base-content/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    STATUS_COLORS[agent.status] ?? 'bg-base-content/30'
                  }`}
                />
                <span className="text-sm font-medium truncate flex-1">
                  {agent.name}
                </span>
              </div>

              <div className="ml-4 mt-1">
                <span className="text-[10px] text-base-content/40 truncate block">
                  {agent.cwd?.split('/').slice(-2).join('/') ?? 'unknown'}
                </span>
                <span className="text-[10px] text-base-content/30 capitalize">
                  {agent.status}
                  {agent.confidence === 'inferred' ? ' ~' : ''}
                </span>
              </div>

              {isActive && (
                <div className="flex gap-1 mt-1.5 ml-4">
                  {isRunning && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onPauseAgent(agent.id)
                      }}
                      className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-warning/20 hover:text-warning"
                      title="Pause agent"
                    >
                      Pause
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onResumeAgent(agent.id)
                      }}
                      className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-success/20 hover:text-success"
                      title="Resume agent"
                    >
                      Resume
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onKillAgent(agent.id)
                    }}
                    className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-error/20 hover:text-error"
                    title="Kill agent"
                  >
                    Kill
                  </button>
                  {onOpenGuardrails && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenGuardrails(agent.id)
                      }}
                      className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-base-content/20"
                      title="Guardrails settings"
                    >
                      &#9881;
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-3 py-2 border-t border-base-content/10">
        <span className="text-[10px] text-base-content/30">
          {agents.filter((a) => a.status === 'busy' || a.status === 'locked').length} active
          {' / '}
          {agents.length} total
        </span>
      </div>
    </aside>
  )
}

export default AgentSidebar
