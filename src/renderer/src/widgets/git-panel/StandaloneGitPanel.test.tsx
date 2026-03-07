import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StandaloneGitPanel from './StandaloneGitPanel'
import type { GitRepoStatus } from '@shared/types/git.types'
import type { RepoConfig } from '@shared/types/config.types'

const mockRepos: RepoConfig[] = [
  { id: 'repo-1', name: 'project-alpha', path: '/home/dev/project-alpha', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'repo-2', name: 'project-beta', path: '/home/dev/project-beta', createdAt: '2026-03-02T00:00:00Z' }
]

const mockStatusAlpha: GitRepoStatus = {
  repoPath: '/home/dev/project-alpha',
  branch: 'main',
  ahead: 2,
  behind: 0,
  staged: [{ path: 'src/index.ts', status: 'M' }],
  unstaged: [{ path: 'src/utils.ts', status: 'M' }],
  untracked: ['temp.log'],
  isDirty: true
}

const mockStatusBeta: GitRepoStatus = {
  repoPath: '/home/dev/project-beta',
  branch: 'develop',
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  untracked: [],
  isDirty: false
}

function mockBridge(): void {
  window.agentHub = {
    db: {
      getRepos: vi.fn().mockResolvedValue({ success: true, data: mockRepos }),
      addRepo: vi.fn(),
      removeRepo: vi.fn()
    },
    git: {
      getStatus: vi.fn().mockImplementation((repoPath: string) => {
        if (repoPath === '/home/dev/project-alpha') {
          return Promise.resolve({ success: true, data: mockStatusAlpha })
        }
        if (repoPath === '/home/dev/project-beta') {
          return Promise.resolve({ success: true, data: mockStatusBeta })
        }
        return Promise.resolve({ success: false, error: { code: 'ERR', message: 'unknown' } })
      }),
      getAllStatus: vi.fn().mockResolvedValue({ success: true, data: [mockStatusAlpha, mockStatusBeta] }),
      getDiff: vi.fn(),
      stageFiles: vi.fn(),
      unstageFiles: vi.fn(),
      commit: vi.fn(),
      push: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      pull: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      getLog: vi.fn(),
      getBranches: vi.fn(),
      suggestCommit: vi.fn()
    }
  } as never
}

describe('StandaloneGitPanel', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockBridge()
  })

  it('renders panel with title', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)
    expect(screen.getByText('Git Overview')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('standalone-git-panel')).toBeInTheDocument()
    })
  })

  it('loads and displays repos on mount', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('repo-card-project-alpha')).toBeInTheDocument()
      expect(screen.getByTestId('repo-card-project-beta')).toBeInTheDocument()
    })
  })

  it('shows correct branch names', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument()
      expect(screen.getByText('develop')).toBeInTheDocument()
    })
  })

  it('shows Dirty badge for dirty repos', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      // project-alpha has ahead > 0, so it shows "Ahead"
      expect(screen.getByText('Ahead')).toBeInTheDocument()
    })
  })

  it('shows Clean badge for clean repos', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Clean')).toBeInTheDocument()
    })
  })

  it('shows ahead/behind indicators', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('+2 ahead')).toBeInTheDocument()
    })
  })

  it('shows file change counts', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('3 changes')).toBeInTheDocument()
      expect(screen.getByText('1 modified')).toBeInTheDocument()
      expect(screen.getByText('1 staged')).toBeInTheDocument()
      expect(screen.getByText('1 untracked')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button clicked', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('git-panel-close')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('git-panel-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls refresh when refresh button clicked', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('git-panel-refresh')).toBeEnabled()
    })

    fireEvent.click(screen.getByTestId('git-panel-refresh'))

    await waitFor(() => {
      // getRepos called twice: once on mount, once on refresh
      expect(window.agentHub.db.getRepos).toHaveBeenCalledTimes(2)
    })
  })

  it('calls pull when pull button clicked', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('repo-pull-project-alpha')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('repo-pull-project-alpha'))

    await waitFor(() => {
      expect(window.agentHub.git.pull).toHaveBeenCalledWith('/home/dev/project-alpha')
    })
  })

  it('calls push when push button clicked', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('repo-push-project-alpha')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('repo-push-project-alpha'))

    await waitFor(() => {
      expect(window.agentHub.git.push).toHaveBeenCalledWith({
        repoPath: '/home/dev/project-alpha',
        branch: 'main'
      })
    })
  })

  it('calls sync (pull then push) when sync button clicked', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('repo-sync-project-alpha')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('repo-sync-project-alpha'))

    await waitFor(() => {
      expect(window.agentHub.git.pull).toHaveBeenCalledWith('/home/dev/project-alpha')
      expect(window.agentHub.git.push).toHaveBeenCalledWith({
        repoPath: '/home/dev/project-alpha',
        branch: 'main'
      })
    })
  })

  it('calls sync all when Sync All button clicked', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('git-panel-sync-all')).toBeEnabled()
    })

    fireEvent.click(screen.getByTestId('git-panel-sync-all'))

    await waitFor(() => {
      expect(window.agentHub.git.pull).toHaveBeenCalledWith('/home/dev/project-alpha')
      expect(window.agentHub.git.pull).toHaveBeenCalledWith('/home/dev/project-beta')
      expect(window.agentHub.git.push).toHaveBeenCalledWith({
        repoPath: '/home/dev/project-alpha',
        branch: 'main'
      })
      expect(window.agentHub.git.push).toHaveBeenCalledWith({
        repoPath: '/home/dev/project-beta',
        branch: 'develop'
      })
    })
  })

  it('shows empty state when no repos exist', async () => {
    vi.mocked(window.agentHub.db.getRepos).mockResolvedValue({
      success: true,
      data: []
    })

    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('No repos tracked yet')).toBeInTheDocument()
    })
  })

  it('shows Behind badge when repo is behind', async () => {
    const behindStatus: GitRepoStatus = {
      ...mockStatusBeta,
      behind: 3,
      isDirty: false
    }
    vi.mocked(window.agentHub.git.getStatus).mockImplementation((repoPath: string) => {
      if (repoPath === '/home/dev/project-alpha') {
        return Promise.resolve({ success: true, data: mockStatusAlpha })
      }
      return Promise.resolve({ success: true, data: behindStatus })
    })

    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Behind')).toBeInTheDocument()
      expect(screen.getByText('-3 behind')).toBeInTheDocument()
    })
  })

  it('renders pull/push/sync buttons for each repo', async () => {
    render(<StandaloneGitPanel onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('repo-pull-project-alpha')).toBeInTheDocument()
      expect(screen.getByTestId('repo-push-project-alpha')).toBeInTheDocument()
      expect(screen.getByTestId('repo-sync-project-alpha')).toBeInTheDocument()
      expect(screen.getByTestId('repo-pull-project-beta')).toBeInTheDocument()
      expect(screen.getByTestId('repo-push-project-beta')).toBeInTheDocument()
      expect(screen.getByTestId('repo-sync-project-beta')).toBeInTheDocument()
    })
  })
})
