import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useGitStore } from './git-store'
import type { GitRepoStatus, GitDiffResult, GitCommitEntry, GitBranchInfo } from '@shared/types/git.types'

const mockStatus: GitRepoStatus = {
  repoPath: '/test/repo',
  branch: 'main',
  ahead: 0,
  behind: 0,
  staged: [{ path: 'src/app.ts', status: 'M' }],
  unstaged: [],
  untracked: [],
  isDirty: true
}

const mockDiff: GitDiffResult = {
  repoPath: '/test/repo',
  diff: '+added line',
  stats: { insertions: 1, deletions: 0, filesChanged: 1 }
}

const mockLog: GitCommitEntry[] = [
  { hash: 'abc123', shortHash: 'abc12', author: 'Dev', date: '2026-03-06', message: 'feat: init' }
]

const mockBranches: GitBranchInfo = {
  current: 'main',
  branches: ['main', 'dev']
}

function mockBridge(): void {
  window.agentHub = {
    git: {
      getStatus: vi.fn().mockResolvedValue({ success: true, data: mockStatus }),
      getAllStatus: vi.fn().mockResolvedValue({ success: true, data: [mockStatus] }),
      getDiff: vi.fn().mockResolvedValue({ success: true, data: mockDiff }),
      stageFiles: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      unstageFiles: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      commit: vi.fn().mockResolvedValue({ success: true, data: 'abc123' }),
      push: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      pull: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      getLog: vi.fn().mockResolvedValue({ success: true, data: mockLog }),
      getBranches: vi.fn().mockResolvedValue({ success: true, data: mockBranches }),
      suggestCommit: vi.fn().mockResolvedValue({ success: true, data: 'feat: update 1 file' })
    }
  } as never
}

describe('git-store', () => {
  beforeEach(() => {
    mockBridge()
    useGitStore.setState({
      status: null,
      diff: null,
      log: [],
      branches: null,
      suggestedMessage: '',
      loading: false,
      error: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchStatus', () => {
    it('sets status on success', async () => {
      await useGitStore.getState().fetchStatus('/test/repo')
      expect(useGitStore.getState().status).toEqual(mockStatus)
      expect(useGitStore.getState().loading).toBe(false)
    })

    it('sets error on failure', async () => {
      vi.mocked(window.agentHub.git.getStatus).mockResolvedValue({
        success: false,
        error: { code: 'ERR', message: 'not a repo' }
      })
      await useGitStore.getState().fetchStatus('/bad/path')
      expect(useGitStore.getState().error).toBe('not a repo')
    })
  })

  describe('fetchDiff', () => {
    it('sets diff data', async () => {
      await useGitStore.getState().fetchDiff('/test/repo', true)
      expect(useGitStore.getState().diff).toEqual(mockDiff)
      expect(window.agentHub.git.getDiff).toHaveBeenCalledWith({ repoPath: '/test/repo', staged: true })
    })
  })

  describe('fetchLog', () => {
    it('sets log entries', async () => {
      await useGitStore.getState().fetchLog('/test/repo', 10)
      expect(useGitStore.getState().log).toEqual(mockLog)
    })
  })

  describe('fetchBranches', () => {
    it('sets branch info', async () => {
      await useGitStore.getState().fetchBranches('/test/repo')
      expect(useGitStore.getState().branches).toEqual(mockBranches)
    })
  })

  describe('fetchSuggestedMessage', () => {
    it('sets suggested message', async () => {
      await useGitStore.getState().fetchSuggestedMessage('/test/repo')
      expect(useGitStore.getState().suggestedMessage).toBe('feat: update 1 file')
    })
  })

  describe('stageFiles', () => {
    it('returns true on success', async () => {
      const ok = await useGitStore.getState().stageFiles('/test/repo', ['file.ts'])
      expect(ok).toBe(true)
      expect(window.agentHub.git.stageFiles).toHaveBeenCalledWith({
        repoPath: '/test/repo',
        files: ['file.ts']
      })
    })

    it('returns false on error', async () => {
      vi.mocked(window.agentHub.git.stageFiles).mockRejectedValue(new Error('fail'))
      const ok = await useGitStore.getState().stageFiles('/test/repo', ['file.ts'])
      expect(ok).toBe(false)
    })
  })

  describe('unstageFiles', () => {
    it('returns true on success', async () => {
      const ok = await useGitStore.getState().unstageFiles('/test/repo', ['file.ts'])
      expect(ok).toBe(true)
    })
  })

  describe('commit', () => {
    it('returns true and clears loading on success', async () => {
      const ok = await useGitStore.getState().commit('/test/repo', 'feat: stuff')
      expect(ok).toBe(true)
      expect(useGitStore.getState().loading).toBe(false)
    })

    it('sets error on failure', async () => {
      vi.mocked(window.agentHub.git.commit).mockResolvedValue({
        success: false,
        error: { code: 'ERR', message: 'nothing to commit' }
      })
      const ok = await useGitStore.getState().commit('/test/repo', 'msg')
      expect(ok).toBe(false)
    })
  })

  describe('push', () => {
    it('returns true on success', async () => {
      const ok = await useGitStore.getState().push('/test/repo', 'main')
      expect(ok).toBe(true)
    })
  })

  describe('pull', () => {
    it('returns true on success', async () => {
      const ok = await useGitStore.getState().pull('/test/repo')
      expect(ok).toBe(true)
    })
  })

  describe('clearError', () => {
    it('clears error state', () => {
      useGitStore.setState({ error: 'some error' })
      useGitStore.getState().clearError()
      expect(useGitStore.getState().error).toBeNull()
    })
  })
})
