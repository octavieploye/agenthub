import { useMemo } from 'react'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useViewStore } from '@renderer/stores/view-store'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

interface RepoSidebarProps {
  onAddRepo?: () => void
}

interface RepoDerived {
  repoId: string
  agentCount: number
  hasAttention: boolean
}

const ATTENTION_STATUSES = new Set<AgentLifecycleStatus>([
  'locked',
  'awaiting_approval',
  'error',
  'looping'
])

const getRepoName = (repoId: string): string =>
  repoId.split('/').filter(Boolean).pop() ?? repoId

function RepoSidebar({ onAddRepo }: RepoSidebarProps): React.JSX.Element {
  const agents = useAgentStore((s) => s.agents)
  const selectedRepoId = useViewStore((s) => s.selectedRepoId)
  const setSelectedRepoId = useViewStore((s) => s.setSelectedRepoId)

  const repos = useMemo<RepoDerived[]>(() => {
    const map = new Map<string, RepoDerived>()
    for (const agent of agents.values()) {
      const existing = map.get(agent.repoId)
      const hasAttention = ATTENTION_STATUSES.has(agent.status)
      if (existing) {
        existing.agentCount += 1
        if (hasAttention) existing.hasAttention = true
      } else {
        map.set(agent.repoId, { repoId: agent.repoId, agentCount: 1, hasAttention })
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.hasAttention !== b.hasAttention) return a.hasAttention ? -1 : 1
      return a.repoId.localeCompare(b.repoId)
    })
  }, [agents])

  return (
    <aside className="w-56 shrink-0 panel-glass border-r border-base-content/10 flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-content/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
          Repos
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {repos.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-base-content/60">
            No repos yet
          </div>
        )}

        {repos.map((repo) => (
          <div
            key={repo.repoId}
            role="button"
            aria-label={`Repo ${getRepoName(repo.repoId)}`}
            onClick={() => setSelectedRepoId(repo.repoId)}
            className={`card-elevated mx-1 mb-0.5 px-2 py-2 cursor-pointer${
              selectedRepoId === repo.repoId ? ' card-active' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              {repo.hasAttention && (
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-breathe shrink-0" />
              )}
              {!repo.hasAttention && (
                <span className="inline-block w-2 h-2 rounded-full bg-transparent shrink-0" />
              )}
              <span className="text-sm font-medium truncate flex-1">
                {getRepoName(repo.repoId)}
              </span>
              <span className="text-[11px] bg-base-content/15 text-base-content/60 rounded px-1 shrink-0">
                {repo.agentCount}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-base-content/10">
        <button
          onClick={onAddRepo}
          className="btn-hub w-full text-xs"
        >
          + Add Repo
        </button>
      </div>
    </aside>
  )
}

export default RepoSidebar
