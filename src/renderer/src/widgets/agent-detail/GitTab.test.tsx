import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GitTab from './GitTab'
import { useGitStore } from '../../stores/git-store'
import type { AgentState } from '@shared/types/agent.types'
import type { GitRepoStatus, GitCommitEntry, GitBranchInfo, GitDiffResult } from '@shared/types/git.types'

const mockAgent: AgentState = {
  id: 'agent-1',
  repoId: 'repo-1',
  name: 'TestAgent',
  status: 'idle',
  confidence: 'confirmed',
  model: 'claude-opus-4-6',
  provider: 'anthropic',
  taskDescription: 'test',
  pid: 1234,
  ptyFd: null,
  cwd: '/test/repo',
  createdAt: '2026-03-06T00:00:00Z',
  updatedAt: '2026-03-06T00:00:00Z',
  progress: 0,
  color: '#3B82F6'
}

const mockStatus: GitRepoStatus = {
  repoPath: '/test/repo',
  branch: 'main',
  ahead: 1,
  behind: 0,
  staged: [{ path: 'src/app.ts', status: 'M' }],
  unstaged: [{ path: 'src/other.ts', status: 'M' }],
  untracked: ['temp.log'],
  isDirty: true
}

const mockLog: GitCommitEntry[] = [
  {
    hash: 'abc123def456',
    shortHash: 'abc123d',
    author: 'Dev',
    date: '2026-03-06T10:00:00Z',
    message: 'feat: initial commit'
  },
  {
    hash: 'def456abc789',
    shortHash: 'def456a',
    author: 'Dev',
    date: '2026-03-05T09:00:00Z',
    message: 'fix: patch'
  }
]

const mockBranches: GitBranchInfo = {
  current: 'main',
  branches: ['main', 'dev']
}

const mockDiff: GitDiffResult = {
  repoPath: '/test/repo',
  diff: [
    'diff --git a/src/app.ts b/src/app.ts',
    '--- a/src/app.ts',
    '+++ b/src/app.ts',
    '@@ -1,3 +1,4 @@',
    ' import { foo } from "bar"',
    '-const old = true',
    '+const updated = true',
    '+const added = false'
  ].join('\n'),
  stats: { insertions: 2, deletions: 1, filesChanged: 1 }
}

function setupStore(overrides: Partial<ReturnType<typeof useGitStore.getState>> = {}): void {
  useGitStore.setState({
    status: mockStatus,
    diff: null,
    log: mockLog,
    branches: mockBranches,
    suggestedMessage: '',
    loading: false,
    error: null,
    fetchStatus: vi.fn(),
    fetchDiff: vi.fn(),
    fetchLog: vi.fn(),
    fetchBranches: vi.fn(),
    fetchSuggestedMessage: vi.fn(),
    stageFiles: vi.fn().mockResolvedValue(true),
    unstageFiles: vi.fn().mockResolvedValue(true),
    commit: vi.fn().mockResolvedValue(true),
    push: vi.fn().mockResolvedValue(true),
    pull: vi.fn().mockResolvedValue(true),
    clearError: vi.fn(),
    ...overrides
  })
}

describe('GitTab', () => {
  beforeEach(() => {
    setupStore()
  })

  it('renders status section by default', () => {
    render(<GitTab agent={mockAgent} />)
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('Dirty')).toBeInTheDocument()
    expect(screen.getByText('src/app.ts')).toBeInTheDocument()
    expect(screen.getByText('src/other.ts')).toBeInTheDocument()
    expect(screen.getByText('temp.log')).toBeInTheDocument()
  })

  it('shows ahead/behind counts', () => {
    render(<GitTab agent={mockAgent} />)
    expect(screen.getByText('+1 ahead')).toBeInTheDocument()
  })

  it('shows Clean badge when not dirty', () => {
    setupStore({
      status: { ...mockStatus, isDirty: false, staged: [], unstaged: [], untracked: [] }
    })
    render(<GitTab agent={mockAgent} />)
    expect(screen.getByText('Clean')).toBeInTheDocument()
  })

  it('fetches git data on mount', () => {
    const fetchStatus = vi.fn()
    const fetchLog = vi.fn()
    const fetchBranches = vi.fn()
    setupStore({ fetchStatus, fetchLog, fetchBranches })

    render(<GitTab agent={mockAgent} />)

    expect(fetchStatus).toHaveBeenCalledWith('/test/repo')
    expect(fetchLog).toHaveBeenCalledWith('/test/repo', 20)
    expect(fetchBranches).toHaveBeenCalledWith('/test/repo')
  })

  it('switches to commit section', () => {
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-commit'))
    expect(screen.getByTestId('commit-message')).toBeInTheDocument()
    expect(screen.getByTestId('commit-button')).toBeInTheDocument()
  })

  it('switches to log section', () => {
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-log'))
    expect(screen.getByText('abc123d')).toBeInTheDocument()
    expect(screen.getByText('feat: initial commit')).toBeInTheDocument()
    expect(screen.getByText('fix: patch')).toBeInTheDocument()
  })

  it('calls stageFiles when stage button clicked', async () => {
    const stageFilesFn = vi.fn().mockResolvedValue(true)
    setupStore({ stageFiles: stageFilesFn })

    render(<GitTab agent={mockAgent} />)
    const stageButtons = screen.getAllByText('Stage')
    fireEvent.click(stageButtons[0])

    await waitFor(() => {
      expect(stageFilesFn).toHaveBeenCalledWith('/test/repo', ['src/other.ts'])
    })
  })

  it('calls unstageFiles when unstage button clicked', async () => {
    const unstageFilesFn = vi.fn().mockResolvedValue(true)
    setupStore({ unstageFiles: unstageFilesFn })

    render(<GitTab agent={mockAgent} />)
    const unstageButtons = screen.getAllByText('Unstage')
    fireEvent.click(unstageButtons[0])

    await waitFor(() => {
      expect(unstageFilesFn).toHaveBeenCalledWith('/test/repo', ['src/app.ts'])
    })
  })

  it('commits with message', async () => {
    const commitFn = vi.fn().mockResolvedValue(true)
    setupStore({ commit: commitFn })

    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-commit'))

    const textarea = screen.getByTestId('commit-message')
    fireEvent.change(textarea, { target: { value: 'feat: new feature' } })
    fireEvent.click(screen.getByTestId('commit-button'))

    await waitFor(() => {
      expect(commitFn).toHaveBeenCalledWith('/test/repo', 'feat: new feature')
    })
  })

  it('disables commit button when message is empty', () => {
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-commit'))
    expect(screen.getByTestId('commit-button')).toBeDisabled()
  })

  it('calls pull when pull button clicked', async () => {
    const pullFn = vi.fn().mockResolvedValue(true)
    setupStore({ pull: pullFn })

    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByText('Pull'))

    await waitFor(() => {
      expect(pullFn).toHaveBeenCalledWith('/test/repo')
    })
  })

  it('calls push when push button clicked', async () => {
    const pushFn = vi.fn().mockResolvedValue(true)
    setupStore({ push: pushFn })

    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByText('Push'))

    await waitFor(() => {
      expect(pushFn).toHaveBeenCalledWith('/test/repo', 'main')
    })
  })

  it('shows error banner', () => {
    setupStore({ error: 'fatal: not a git repository' })
    render(<GitTab agent={mockAgent} />)
    expect(screen.getByText('fatal: not a git repository')).toBeInTheDocument()
  })

  it('clears error on dismiss', () => {
    const clearError = vi.fn()
    setupStore({ error: 'some error', clearError })
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByText('Dismiss'))
    expect(clearError).toHaveBeenCalled()
  })

  it('shows loading state', () => {
    setupStore({ loading: true })
    render(<GitTab agent={mockAgent} />)
    expect(screen.getByTestId('git-content').children.length).toBe(0)
  })

  it('shows empty log message', () => {
    setupStore({ log: [] })
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-log'))
    expect(screen.getByText('No commits found')).toBeInTheDocument()
  })

  it('shows no status message when status is null', () => {
    setupStore({ status: null })
    render(<GitTab agent={mockAgent} />)
    expect(screen.getByText('No git status available')).toBeInTheDocument()
  })

  it('calls suggest message and switches to commit section', async () => {
    const fetchSuggestedMessage = vi.fn()
    setupStore({ fetchSuggestedMessage })

    render(<GitTab agent={mockAgent} />)
    // Click the "Commit" link in the staged section (not the section toggle)
    const commitLinks = screen.getAllByText('Commit')
    // The second one is the inline commit link in staged files area
    const inlineCommit = commitLinks.find(
      (el) => el.classList.contains('text-primary')
    )
    fireEvent.click(inlineCommit ?? commitLinks[commitLinks.length - 1])

    await waitFor(() => {
      expect(fetchSuggestedMessage).toHaveBeenCalledWith('/test/repo')
    })
  })

  it('shows branch count', () => {
    render(<GitTab agent={mockAgent} />)
    expect(screen.getByText('2 branches')).toBeInTheDocument()
  })

  it('switches to diff section and shows diff content', async () => {
    const fetchDiff = vi.fn()
    setupStore({ diff: mockDiff, fetchDiff })

    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-diff'))

    await waitFor(() => {
      expect(fetchDiff).toHaveBeenCalledWith('/test/repo', false)
    })
    expect(screen.getByTestId('diff-content')).toBeInTheDocument()
    expect(screen.getByText(/const updated = true/)).toBeInTheDocument()
  })

  it('shows diff stats', () => {
    setupStore({ diff: mockDiff })
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-diff'))

    const stats = screen.getByTestId('diff-stats')
    expect(stats).toHaveTextContent('1 files changed')
    expect(stats).toHaveTextContent('2 insertions(+)')
    expect(stats).toHaveTextContent('1 deletions(-)')
  })

  it('toggles between staged and unstaged diff', async () => {
    const fetchDiff = vi.fn()
    setupStore({ diff: mockDiff, fetchDiff })

    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-diff'))

    // Initially unstaged is active
    await waitFor(() => {
      expect(fetchDiff).toHaveBeenCalledWith('/test/repo', false)
    })

    // Click staged toggle
    fireEvent.click(screen.getByTestId('diff-staged-toggle'))
    await waitFor(() => {
      expect(fetchDiff).toHaveBeenCalledWith('/test/repo', true)
    })

    // Click unstaged toggle
    fireEvent.click(screen.getByTestId('diff-unstaged-toggle'))
    await waitFor(() => {
      expect(fetchDiff).toHaveBeenLastCalledWith('/test/repo', false)
    })
  })

  it('highlights diff lines with correct CSS classes', () => {
    setupStore({ diff: mockDiff })
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-diff'))

    // Line 0: "diff --git ..." → bold
    const line0 = screen.getByTestId('diff-line-0')
    expect(line0.className).toContain('font-bold')

    // Line 3: "@@ -1,3 +1,4 @@" → info color
    const line3 = screen.getByTestId('diff-line-3')
    expect(line3.className).toContain('text-info')

    // Line 5: "-const old = true" → red/error
    const line5 = screen.getByTestId('diff-line-5')
    expect(line5.className).toContain('bg-error/10')
    expect(line5.className).toContain('text-error')

    // Line 6: "+const updated = true" → green/success
    const line6 = screen.getByTestId('diff-line-6')
    expect(line6.className).toContain('bg-success/10')
    expect(line6.className).toContain('text-success')
  })

  it('shows empty diff message when diff is empty', () => {
    setupStore({
      diff: { repoPath: '/test/repo', diff: '', stats: { insertions: 0, deletions: 0, filesChanged: 0 } }
    })
    render(<GitTab agent={mockAgent} />)
    fireEvent.click(screen.getByTestId('git-section-diff'))
    expect(screen.getByText('No changes')).toBeInTheDocument()
  })
})
