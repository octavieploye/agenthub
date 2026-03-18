import { useMemo, useState } from 'react'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useViewStore } from '@renderer/stores/view-store'
import { RepoFileTree } from '@renderer/widgets/repo-file-tree'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

interface RepoSidebarProps {
  onAddRepo?: () => void
}

interface RepoDerived {
  repoId: string
  repoName: string
  repoCwd: string
  agentCount: number
  hasAttention: boolean
}

const ATTENTION_STATUSES = new Set<AgentLifecycleStatus>([
  'locked',
  'awaiting_approval',
  'error',
  'looping'
])

function RepoSidebar({ onAddRepo }: RepoSidebarProps): React.JSX.Element {
  const agents = useAgentStore((s) => s.agents)
  const selectedRepoId = useViewStore((s) => s.selectedRepoId)
  const setSelectedRepoId = useViewStore((s) => s.setSelectedRepoId)
  const expandedRepoFileTree = useViewStore((s) => s.expandedRepoFileTree)
  const setExpandedRepoFileTree = useViewStore((s) => s.setExpandedRepoFileTree)
  const [hoveredRepo, setHoveredRepo] = useState<string | null>(null)

  const repos = useMemo<RepoDerived[]>(() => {
    const map = new Map<string, RepoDerived>()
    for (const agent of agents.values()) {
      const existing = map.get(agent.repoId)
      const hasAttention = ATTENTION_STATUSES.has(agent.status)
      if (existing) {
        existing.agentCount += 1
        if (hasAttention) existing.hasAttention = true
      } else {
        const repoName = agent.cwd.split('/').filter(Boolean).pop() ?? agent.repoId
        map.set(agent.repoId, { repoId: agent.repoId, repoName, repoCwd: agent.cwd, agentCount: 1, hasAttention })
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.hasAttention !== b.hasAttention) return a.hasAttention ? -1 : 1
      return a.repoId.localeCompare(b.repoId)
    })
  }, [agents])

  const hasTreeOpen = expandedRepoFileTree !== null

  const handleToggleTree = (repoId: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    setExpandedRepoFileTree(expandedRepoFileTree === repoId ? null : repoId)
  }

  return (
    <aside
      className={`shrink-0 panel-glass border-r border-base-content/10 flex flex-col h-full transition-[width] duration-200 ${
        hasTreeOpen ? 'w-72' : 'w-56'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-content/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
          Repos
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {repos.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-base-content/40">
            Add a repo to get started
          </div>
        )}

        {repos.map((repo) => (
          <div key={repo.repoId}>
            <div
              role="button"
              aria-label={`Repo ${repo.repoName}`}
              onClick={() => setSelectedRepoId(repo.repoId)}
              onMouseEnter={() => setHoveredRepo(repo.repoId)}
              onMouseLeave={() => setHoveredRepo(null)}
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
                  {repo.repoName}
                </span>

                {/* File tree toggle button — visible on hover */}
                {(hoveredRepo === repo.repoId || expandedRepoFileTree === repo.repoId) && (
                  <button
                    onClick={(e) => handleToggleTree(repo.repoId, e)}
                    className={`text-[13px] shrink-0 rounded p-0.5 transition-colors ${
                      expandedRepoFileTree === repo.repoId
                        ? 'text-base-content/70 bg-base-content/10'
                        : 'text-base-content/40 hover:text-base-content/60'
                    }`}
                    title="Browse files"
                  >
                    📂
                  </button>
                )}

                <span className="text-[11px] bg-base-content/15 text-base-content/60 rounded px-1 shrink-0">
                  {repo.agentCount}
                </span>
              </div>
            </div>

            {/* Inline file tree accordion */}
            {expandedRepoFileTree === repo.repoId && (
              <div className="mx-1 mb-1 border border-base-content/10 rounded-b-lg bg-base-content/[0.02] overflow-hidden">
                <RepoFileTree repoPath={repo.repoCwd} />
              </div>
            )}
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
