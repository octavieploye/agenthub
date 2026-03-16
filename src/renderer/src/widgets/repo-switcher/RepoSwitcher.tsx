import { useState, useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useViewStore } from '@renderer/stores/view-store'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

export interface RepoSwitcherHandle {
  focus: () => void
}

interface RepoSwitcherProps {
  id?: string
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

const RepoSwitcher = forwardRef<RepoSwitcherHandle, RepoSwitcherProps>(
  function RepoSwitcher({ id }, ref) {
    const agents = useAgentStore((s) => s.agents)
    const selectedRepoId = useViewStore((s) => s.selectedRepoId)
    const setSelectedRepoId = useViewStore((s) => s.setSelectedRepoId)

    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => triggerRef.current?.focus()
    }))

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

    const currentRepo = repos.find((r) => r.repoId === selectedRepoId) ?? repos[0] ?? null

    // Close on click outside
    useEffect(() => {
      if (!open) return
      const handlePointerDown = (e: PointerEvent): void => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [open])

    // Close on Escape
    useEffect(() => {
      if (!open) return
      const handleKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          setOpen(false)
          triggerRef.current?.focus()
        }
      }
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }, [open])

    if (repos.length === 0) {
      return (
        <span
          id={id}
          className="text-[11px] text-base-content/40 px-2 py-1 font-mono"
        >
          No repos
        </span>
      )
    }

    return (
      <div ref={containerRef} className="relative" id={id}>
        <button
          ref={triggerRef}
          data-testid="repo-switcher-trigger"
          onClick={() => setOpen((prev) => !prev)}
          className="btn-hub btn-xs flex items-center gap-1.5 border border-base-content/15 bg-base-content/5 text-[11px] font-mono"
          title="Switch repository"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {currentRepo?.hasAttention && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-breathe shrink-0" />
          )}
          <span className="max-w-[120px] truncate">
            {currentRepo ? getRepoName(currentRepo.repoId) : '—'}
          </span>
          {currentRepo && (
            <span className="text-base-content/40 text-[10px]">
              {currentRepo.agentCount}
            </span>
          )}
          <span className="text-base-content/40 text-[10px] ml-0.5">▾</span>
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Select repository"
            className="dropdown-panel absolute right-0 top-full mt-1 min-w-[200px]"
          >
            {repos.map((repo) => (
              <div
                key={repo.repoId}
                role="option"
                aria-selected={repo.repoId === selectedRepoId}
                data-testid={`repo-option-${repo.repoId}`}
                onClick={() => {
                  setSelectedRepoId(repo.repoId)
                  setOpen(false)
                }}
                className={`dropdown-item flex items-center gap-2${repo.repoId === selectedRepoId ? ' active' : ''}`}
              >
                {repo.hasAttention ? (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-breathe shrink-0" />
                ) : (
                  <span className="inline-block w-1.5 h-1.5 shrink-0" />
                )}
                <span className="flex-1 truncate font-mono text-[12px]">
                  {getRepoName(repo.repoId)}
                </span>
                <span className="text-[10px] bg-base-content/10 text-base-content/50 rounded px-1 shrink-0">
                  {repo.agentCount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)

export default RepoSwitcher
