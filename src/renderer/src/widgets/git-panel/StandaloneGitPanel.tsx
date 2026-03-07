import { useState, useEffect, useCallback } from 'react'
import type { GitRepoStatus } from '@shared/types/git.types'
import type { RepoConfig } from '@shared/types/config.types'

interface RepoGitInfo {
  repoPath: string
  repoName: string
  branch: string
  isDirty: boolean
  ahead: number
  behind: number
  modifiedCount: number
  stagedCount: number
  untrackedCount: number
}

interface StandaloneGitPanelProps {
  onClose: () => void
}

function getStatusBadge(info: RepoGitInfo): { label: string; className: string } {
  if (info.behind > 0) return { label: 'Behind', className: 'badge-warning' }
  if (info.ahead > 0) return { label: 'Ahead', className: 'badge-info' }
  if (info.isDirty) return { label: 'Dirty', className: 'badge-warning' }
  return { label: 'Clean', className: 'badge-success' }
}

function buildRepoGitInfo(repo: RepoConfig, status: GitRepoStatus): RepoGitInfo {
  return {
    repoPath: repo.path,
    repoName: repo.name,
    branch: status.branch,
    isDirty: status.isDirty,
    ahead: status.ahead,
    behind: status.behind,
    modifiedCount: status.unstaged.filter((f) => f.status === 'M').length,
    stagedCount: status.staged.length,
    untrackedCount: status.untracked.length
  }
}

function StandaloneGitPanel({ onClose }: StandaloneGitPanelProps): React.JSX.Element {
  const [repos, setRepos] = useState<RepoGitInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAllStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const reposRes = await window.agentHub.db.getRepos()
      if (!reposRes.success) {
        setError('Failed to load repos')
        setLoading(false)
        return
      }

      const repoList = reposRes.data
      const statuses: RepoGitInfo[] = []

      for (const repo of repoList) {
        try {
          const statusRes = await window.agentHub.git.getStatus(repo.path)
          if (statusRes.success && statusRes.data) {
            statuses.push(buildRepoGitInfo(repo, statusRes.data))
          }
        } catch {
          /* skip repos that error */
        }
      }

      setRepos(statuses)
    } catch {
      setError('Failed to fetch git status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllStatus()
  }, [fetchAllStatus])

  const handlePull = useCallback(
    async (repoPath: string) => {
      setSyncing(repoPath)
      try {
        await window.agentHub.git.pull(repoPath)
        await fetchAllStatus()
      } catch {
        setError(`Pull failed for ${repoPath}`)
      } finally {
        setSyncing(null)
      }
    },
    [fetchAllStatus]
  )

  const handlePush = useCallback(
    async (repoPath: string) => {
      setSyncing(repoPath)
      try {
        const repo = repos.find((r) => r.repoPath === repoPath)
        await window.agentHub.git.push({ repoPath, branch: repo?.branch })
        await fetchAllStatus()
      } catch {
        setError(`Push failed for ${repoPath}`)
      } finally {
        setSyncing(null)
      }
    },
    [repos, fetchAllStatus]
  )

  const handleSync = useCallback(
    async (repoPath: string) => {
      setSyncing(repoPath)
      try {
        await window.agentHub.git.pull(repoPath)
        const repo = repos.find((r) => r.repoPath === repoPath)
        await window.agentHub.git.push({ repoPath, branch: repo?.branch })
        await fetchAllStatus()
      } catch {
        setError(`Sync failed for ${repoPath}`)
      } finally {
        setSyncing(null)
      }
    },
    [repos, fetchAllStatus]
  )

  const handleSyncAll = useCallback(async () => {
    setSyncing('all')
    try {
      for (const repo of repos) {
        try {
          await window.agentHub.git.pull(repo.repoPath)
          await window.agentHub.git.push({ repoPath: repo.repoPath, branch: repo.branch })
        } catch {
          /* continue with other repos */
        }
      }
      await fetchAllStatus()
    } finally {
      setSyncing(null)
    }
  }, [repos, fetchAllStatus])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        data-testid="standalone-git-panel"
        className="panel-glass w-full max-w-2xl mx-4 rounded-xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-content/10 shrink-0">
          <h2 className="text-lg font-bold">Git Overview</h2>
          <div className="flex items-center gap-2">
            <button
              data-testid="git-panel-sync-all"
              className="btn-lcars btn-primary btn-sm text-xs"
              onClick={handleSyncAll}
              disabled={syncing !== null || repos.length === 0}
            >
              {syncing === 'all' ? 'Syncing...' : 'Sync All'}
            </button>
            <button
              data-testid="git-panel-refresh"
              className="btn btn-sm btn-ghost text-xs"
              onClick={fetchAllStatus}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              data-testid="git-panel-close"
              className="btn btn-sm btn-ghost btn-circle"
              onClick={onClose}
            >
              X
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            data-testid="git-panel-error"
            className="flex items-center justify-between px-6 py-2 bg-error/10 text-error text-xs shrink-0"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="btn btn-ghost btn-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" data-testid="git-panel-content">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <span className="loading loading-dots loading-sm text-base-content/40" />
            </div>
          )}

          {!loading && repos.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-base-content/40">No repos tracked yet</p>
            </div>
          )}

          {!loading && repos.length > 0 && (
            <div className="grid gap-3">
              {repos.map((repo) => {
                const badge = getStatusBadge(repo)
                const isSyncing = syncing === repo.repoPath || syncing === 'all'
                const totalChanges = repo.modifiedCount + repo.stagedCount + repo.untrackedCount

                return (
                  <div
                    key={repo.repoPath}
                    data-testid={`repo-card-${repo.repoName}`}
                    className="panel-glass rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-base-content truncate">
                              {repo.repoName}
                            </span>
                            <span className={`badge badge-xs ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-base-content/50">
                              {repo.branch}
                            </span>
                            {repo.ahead > 0 && (
                              <span className="text-[10px] text-info">+{repo.ahead} ahead</span>
                            )}
                            {repo.behind > 0 && (
                              <span className="text-[10px] text-warning">
                                -{repo.behind} behind
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {totalChanges > 0 && (
                          <span className="text-[10px] text-base-content/40 mr-2">
                            {totalChanges} change{totalChanges !== 1 ? 's' : ''}
                          </span>
                        )}
                        <button
                          data-testid={`repo-pull-${repo.repoName}`}
                          className="btn btn-ghost btn-xs text-xs"
                          onClick={() => handlePull(repo.repoPath)}
                          disabled={isSyncing}
                        >
                          Pull
                        </button>
                        <button
                          data-testid={`repo-push-${repo.repoName}`}
                          className="btn btn-ghost btn-xs text-xs"
                          onClick={() => handlePush(repo.repoPath)}
                          disabled={isSyncing}
                        >
                          Push
                        </button>
                        <button
                          data-testid={`repo-sync-${repo.repoName}`}
                          className="btn btn-ghost btn-xs text-xs"
                          onClick={() => handleSync(repo.repoPath)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? 'Syncing...' : 'Sync'}
                        </button>
                      </div>
                    </div>

                    {/* File counts breakdown */}
                    {totalChanges > 0 && (
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-base-content/40">
                        {repo.modifiedCount > 0 && (
                          <span>
                            {repo.modifiedCount} modified
                          </span>
                        )}
                        {repo.stagedCount > 0 && (
                          <span>
                            {repo.stagedCount} staged
                          </span>
                        )}
                        {repo.untrackedCount > 0 && (
                          <span>
                            {repo.untrackedCount} untracked
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StandaloneGitPanel
