import { useState, useEffect, useCallback } from 'react'
import { useGitStore } from '../../stores/git-store'
import type { AgentState } from '@shared/types/agent.types'
import type { GitFileChange, GitDiffResult, GitRepoStatus, GitCommitEntry, GitBranchInfo } from '@shared/types/git.types'

interface GitTabProps {
  agent: AgentState
}

type GitSection = 'status' | 'commit' | 'log' | 'diff'

const STATUS_ICON: Record<string, string> = {
  A: '+',
  M: '~',
  D: '-',
  R: '>',
  C: 'C',
  '?': '?'
}

function FileRow({
  file,
  actionLabel,
  onAction
}: {
  file: GitFileChange
  actionLabel: string
  onAction: (path: string) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between py-1 px-2 hover:bg-base-content/5 rounded text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-base-content/50 w-4 text-center shrink-0">
          {STATUS_ICON[file.status] ?? file.status}
        </span>
        <span className="font-mono truncate text-base-content/70">{file.path}</span>
      </div>
      <button
        onClick={() => onAction(file.path)}
        className="btn btn-ghost btn-xs text-base-content/50 shrink-0"
      >
        {actionLabel}
      </button>
    </div>
  )
}

export default function GitTab({ agent }: GitTabProps): React.JSX.Element {

  const repoPath = agent.cwd
  const {
    status,
    diff,
    log,
    branches,
    suggestedMessage,
    loading,
    error,
    fetchStatus,
    fetchDiff,
    fetchLog,
    fetchBranches,
    fetchSuggestedMessage,
    stageFiles,
    unstageFiles,
    commit,
    push,
    pull,
    clearError
  } = useGitStore()
  const fetchGitDataOnce = useGitStore((s) => s.fetchGitDataOnce)

  const [section, setSection] = useState<GitSection>('status')
  const [commitMsg, setCommitMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchGitDataOnce(repoPath)
  }, [repoPath, fetchGitDataOnce])

  const handleStage = useCallback(
    async (path: string) => {
      await stageFiles(repoPath, [path])
      fetchStatus(repoPath)
    },
    [repoPath, stageFiles, fetchStatus]
  )

  const handleUnstage = useCallback(
    async (path: string) => {
      await unstageFiles(repoPath, [path])
      fetchStatus(repoPath)
    },
    [repoPath, unstageFiles, fetchStatus]
  )

  const handleStageAll = useCallback(async () => {
    if (!status) return
    const allFiles = [...status.unstaged.map((f) => f.path), ...status.untracked]
    if (allFiles.length > 0) {
      await stageFiles(repoPath, allFiles)
      fetchStatus(repoPath)
    }
  }, [repoPath, status, stageFiles, fetchStatus])

  const handleUnstageAll = useCallback(async () => {
    if (!status) return
    const files = status.staged.map((f) => f.path)
    if (files.length > 0) {
      await unstageFiles(repoPath, files)
      fetchStatus(repoPath)
    }
  }, [repoPath, status, unstageFiles, fetchStatus])

  const handleSuggest = useCallback(async () => {
    await fetchSuggestedMessage(repoPath)
    setSection('commit')
  }, [repoPath, fetchSuggestedMessage])

  useEffect(() => {
    if (suggestedMessage && section === 'commit' && !commitMsg) {
      setCommitMsg(suggestedMessage)
    }
  }, [suggestedMessage, section, commitMsg])

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return
    setActionLoading(true)
    const ok = await commit(repoPath, commitMsg.trim())
    setActionLoading(false)
    if (ok) {
      setCommitMsg('')
      fetchStatus(repoPath)
      fetchLog(repoPath, 20)
    }
  }, [repoPath, commitMsg, commit, fetchStatus, fetchLog])

  const handlePush = useCallback(async () => {
    setActionLoading(true)
    await push(repoPath, status?.branch)
    setActionLoading(false)
    fetchStatus(repoPath)
  }, [repoPath, status?.branch, push, fetchStatus])

  const handlePull = useCallback(async () => {
    setActionLoading(true)
    await pull(repoPath)
    setActionLoading(false)
    fetchStatus(repoPath)
    fetchLog(repoPath, 20)
  }, [repoPath, pull, fetchStatus, fetchLog])

  const handleRefresh = useCallback(() => {
    fetchStatus(repoPath)
    fetchLog(repoPath, 20)
    fetchBranches(repoPath)
  }, [repoPath, fetchStatus, fetchLog, fetchBranches])

  return (
    <div className="flex flex-col h-full">
      {/* Section toggle + actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-content/10 shrink-0">
        <div className="flex gap-1">
          {(['status', 'commit', 'log', 'diff'] as const).map((s) => (
            <button
              key={s}
              data-testid={`git-section-${s}`}
              onClick={() => setSection(s)}
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                section === s
                  ? 'bg-base-content/10 text-base-content'
                  : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {status && (
            <span className="text-[10px] font-mono text-base-content/40 mr-2">
              {status.branch}
              {status.ahead > 0 && ` +${status.ahead}`}
              {status.behind > 0 && ` -${status.behind}`}
            </span>
          )}
          <button onClick={handlePull} disabled={actionLoading} className="btn btn-ghost btn-xs" title="Pull">
            Pull
          </button>
          <button onClick={handlePush} disabled={actionLoading} className="btn btn-ghost btn-xs" title="Push">
            Push
          </button>
          <button onClick={handleRefresh} className="btn btn-ghost btn-xs" title="Refresh">
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-error/10 text-error text-xs">
          <span>{error}</span>
          <button onClick={clearError} className="btn btn-ghost btn-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-dots loading-sm text-base-content/40" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pt-2" data-testid="git-content">
        {!loading && section === 'status' && (
          <StatusSection
            status={status}
            branches={branches}
            onStage={handleStage}
            onUnstage={handleUnstage}
            onStageAll={handleStageAll}
            onUnstageAll={handleUnstageAll}
            onSuggest={handleSuggest}
          />
        )}

        {!loading && section === 'commit' && (
          <CommitSection
            status={status}
            commitMsg={commitMsg}
            setCommitMsg={setCommitMsg}
            onCommit={handleCommit}
            onSuggest={handleSuggest}
            actionLoading={actionLoading}
          />
        )}

        {!loading && section === 'log' && <LogSection log={log} />}

        {!loading && section === 'diff' && (
          <DiffSection diff={diff} repoPath={repoPath} fetchDiff={fetchDiff} />
        )}
      </div>
    </div>
  )
}

function StatusSection({
  status,
  branches,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  onSuggest
}: {
  status: GitRepoStatus | null
  branches: GitBranchInfo | null
  onStage: (path: string) => void
  onUnstage: (path: string) => void
  onStageAll: () => void
  onUnstageAll: () => void
  onSuggest: () => void
}): React.JSX.Element {
  if (!status) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-base-content/40">No git status available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Branch info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-base-content/70">Branch:</span>
          <span className="text-xs font-mono text-base-content">{status.branch}</span>
          {!status.isDirty && (
            <span className="badge badge-xs badge-success">Clean</span>
          )}
          {status.isDirty && (
            <span className="badge badge-xs badge-warning">Dirty</span>
          )}
        </div>
        {(status.ahead > 0 || status.behind > 0) && (
          <div className="text-[10px] text-base-content/40">
            {status.ahead > 0 && <span className="text-success mr-2">+{status.ahead} ahead</span>}
            {status.behind > 0 && <span className="text-warning">-{status.behind} behind</span>}
          </div>
        )}
        {branches && branches.branches.length > 1 && (
          <div className="text-[10px] text-base-content/30">
            {branches.branches.length} branches
          </div>
        )}
      </div>

      {/* Staged files */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-base-content/60">
            Staged ({status.staged.length})
          </span>
          <div className="flex gap-1">
            {status.staged.length > 0 && (
              <>
                <button onClick={onUnstageAll} className="btn btn-ghost btn-xs text-[10px]">
                  Unstage All
                </button>
                <button onClick={onSuggest} className="btn btn-ghost btn-xs text-[10px] text-primary">
                  Commit
                </button>
              </>
            )}
          </div>
        </div>
        {status.staged.length === 0 && (
          <p className="text-[10px] text-base-content/30 px-2">No staged files</p>
        )}
        {status.staged.map((f) => (
          <FileRow key={f.path} file={f} actionLabel="Unstage" onAction={onUnstage} />
        ))}
      </div>

      {/* Unstaged files */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-base-content/60">
            Unstaged ({status.unstaged.length + status.untracked.length})
          </span>
          {(status.unstaged.length > 0 || status.untracked.length > 0) && (
            <button onClick={onStageAll} className="btn btn-ghost btn-xs text-[10px]">
              Stage All
            </button>
          )}
        </div>
        {status.unstaged.length === 0 && status.untracked.length === 0 && (
          <p className="text-[10px] text-base-content/30 px-2">No changes</p>
        )}
        {status.unstaged.map((f) => (
          <FileRow key={f.path} file={f} actionLabel="Stage" onAction={onStage} />
        ))}
        {status.untracked.map((path) => (
          <FileRow
            key={path}
            file={{ path, status: '?' }}
            actionLabel="Stage"
            onAction={onStage}
          />
        ))}
      </div>
    </div>
  )
}

function CommitSection({
  status,
  commitMsg,
  setCommitMsg,
  onCommit,
  onSuggest,
  actionLoading
}: {
  status: GitRepoStatus | null
  commitMsg: string
  setCommitMsg: (msg: string) => void
  onCommit: () => void
  onSuggest: () => void
  actionLoading: boolean
}): React.JSX.Element {
  const stagedCount = status?.staged.length ?? 0

  return (
    <div className="space-y-3">
      <div className="text-xs text-base-content/60">
        {stagedCount} file{stagedCount !== 1 ? 's' : ''} staged for commit
      </div>

      {status?.staged.map((f) => (
        <div key={f.path} className="flex items-center gap-2 text-xs px-2">
          <span className="font-mono text-base-content/50 w-4 text-center">
            {STATUS_ICON[f.status] ?? f.status}
          </span>
          <span className="font-mono text-base-content/70 truncate">{f.path}</span>
        </div>
      ))}

      <div className="space-y-2">
        <textarea
          data-testid="commit-message"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message..."
          className="textarea textarea-bordered w-full text-xs h-20 resize-none font-mono"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={onCommit}
            disabled={actionLoading || !commitMsg.trim() || stagedCount === 0}
            className="btn btn-primary btn-sm text-xs"
            data-testid="commit-button"
          >
            {actionLoading ? 'Committing...' : 'Commit'}
          </button>
          <button onClick={onSuggest} className="btn btn-ghost btn-sm text-xs" data-testid="suggest-button">
            Suggest Message
          </button>
        </div>
      </div>
    </div>
  )
}

function LogSection({
  log
}: {
  log: GitCommitEntry[]
}): React.JSX.Element {
  if (log.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-base-content/40">No commits found</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {log.map((entry) => (
        <div
          key={entry.hash}
          className="px-2 py-1.5 hover:bg-base-content/5 rounded transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-primary/70 shrink-0">
              {entry.shortHash}
            </span>
            <span className="text-xs text-base-content/80 truncate">{entry.message}</span>
          </div>
          <div className="text-[10px] text-base-content/30 ml-[52px]">
            {entry.author} &middot; {new Date(entry.date).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  )
}

function getDiffLineClass(line: string): string {
  if (line.startsWith('diff --git')) return 'font-bold'
  if (line.startsWith('@@')) return 'text-info'
  if (line.startsWith('+++') || line.startsWith('---')) return ''
  if (line.startsWith('+')) return 'bg-success/10 text-success'
  if (line.startsWith('-')) return 'bg-error/10 text-error'
  return ''
}

function DiffSection({
  diff,
  repoPath,
  fetchDiff
}: {
  diff: GitDiffResult | null
  repoPath: string
  fetchDiff: (repoPath: string, staged?: boolean) => Promise<void>
}): React.JSX.Element {
  const [staged, setStaged] = useState(false)

  useEffect(() => {
    fetchDiff(repoPath, staged)
  }, [repoPath, staged, fetchDiff])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <button
          data-testid="diff-unstaged-toggle"
          onClick={() => setStaged(false)}
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            !staged
              ? 'bg-base-content/10 text-base-content'
              : 'text-base-content/50 hover:text-base-content'
          }`}
        >
          Unstaged
        </button>
        <button
          data-testid="diff-staged-toggle"
          onClick={() => setStaged(true)}
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            staged
              ? 'bg-base-content/10 text-base-content'
              : 'text-base-content/50 hover:text-base-content'
          }`}
        >
          Staged
        </button>
      </div>

      {diff && diff.diff ? (
        <>
          <div data-testid="diff-stats" className="text-xs text-base-content/60">
            {diff.stats.filesChanged} files changed, {diff.stats.insertions} insertions(+), {diff.stats.deletions} deletions(-)
          </div>
          <pre data-testid="diff-content" className="font-mono text-xs whitespace-pre-wrap">
            {diff.diff.split('\n').map((line, idx) => (
              <div key={idx} data-testid={`diff-line-${idx}`} className={getDiffLineClass(line)}>
                {line}
              </div>
            ))}
          </pre>
        </>
      ) : (
        <div className="flex items-center justify-center py-8">
          <p className="text-xs text-base-content/40">No changes</p>
        </div>
      )}
    </div>
  )
}
