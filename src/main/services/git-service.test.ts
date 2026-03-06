import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn()
}))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    default: { ...actual, execFileSync: mockExecFileSync },
    execFileSync: mockExecFileSync
  }
})

import { GitService, type GitServiceDeps } from './git-service'

const mockExec = mockExecFileSync

function createDeps(): GitServiceDeps {
  return {
    logInfo: vi.fn(),
    logWarning: vi.fn()
  }
}

describe('GitService', () => {
  let service: GitService
  let deps: GitServiceDeps

  beforeEach(() => {
    vi.clearAllMocks()
    deps = createDeps()
    service = new GitService(deps)
  })

  describe('getStatus', () => {
    it('returns full repo status for a clean repo', () => {
      mockExec
        .mockReturnValueOnce('main\n') // rev-parse --abbrev-ref HEAD
        .mockReturnValueOnce('0\t0\n') // rev-list --left-right
        .mockReturnValueOnce('') // diff --cached --name-status
        .mockReturnValueOnce('') // diff --name-status
        .mockReturnValueOnce('') // ls-files --others

      const status = service.getStatus('/test/repo')

      expect(status.branch).toBe('main')
      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(0)
      expect(status.staged).toEqual([])
      expect(status.unstaged).toEqual([])
      expect(status.untracked).toEqual([])
      expect(status.isDirty).toBe(false)
    })

    it('returns dirty status with staged and unstaged files', () => {
      mockExec
        .mockReturnValueOnce('feature/xyz\n') // branch
        .mockReturnValueOnce('2\t1\n') // ahead/behind
        .mockReturnValueOnce('M\tsrc/main.ts\nA\tsrc/new.ts\n') // staged
        .mockReturnValueOnce('M\tsrc/other.ts\n') // unstaged
        .mockReturnValueOnce('temp.log\n') // untracked

      const status = service.getStatus('/test/repo')

      expect(status.branch).toBe('feature/xyz')
      expect(status.ahead).toBe(1)
      expect(status.behind).toBe(2)
      expect(status.staged).toEqual([
        { status: 'M', path: 'src/main.ts' },
        { status: 'A', path: 'src/new.ts' }
      ])
      expect(status.unstaged).toEqual([{ status: 'M', path: 'src/other.ts' }])
      expect(status.untracked).toEqual(['temp.log'])
      expect(status.isDirty).toBe(true)
    })

    it('handles missing upstream gracefully', () => {
      mockExec
        .mockReturnValueOnce('main\n') // branch
        .mockImplementationOnce(() => {
          throw new Error('no upstream')
        }) // ahead/behind fails
        .mockReturnValueOnce('') // staged
        .mockReturnValueOnce('') // unstaged
        .mockReturnValueOnce('') // untracked

      const status = service.getStatus('/test/repo')
      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(0)
    })
  })

  describe('getDiff', () => {
    it('returns unstaged diff by default', () => {
      mockExec
        .mockReturnValueOnce('diff --git a/file.ts b/file.ts\n+added line\n') // diff
        .mockReturnValueOnce(' 1 file changed, 1 insertion(+)\n') // shortstat

      const result = service.getDiff('/test/repo')

      expect(result.diff).toContain('+added line')
      expect(result.stats.filesChanged).toBe(1)
      expect(result.stats.insertions).toBe(1)
      expect(result.stats.deletions).toBe(0)
    })

    it('returns staged diff when requested', () => {
      mockExec
        .mockReturnValueOnce('staged diff content\n') // diff --cached
        .mockReturnValueOnce(' 2 files changed, 3 insertions(+), 1 deletion(-)\n') // shortstat

      const result = service.getDiff('/test/repo', true)

      expect(result.diff).toContain('staged diff content')
      expect(result.stats.filesChanged).toBe(2)
      expect(result.stats.insertions).toBe(3)
      expect(result.stats.deletions).toBe(1)
      expect(mockExec).toHaveBeenCalledWith('git', ['diff', '--cached'], expect.any(Object))
    })
  })

  describe('stageFiles', () => {
    it('stages specified files', () => {
      mockExec.mockReturnValueOnce('')
      service.stageFiles('/test/repo', ['src/a.ts', 'src/b.ts'])

      expect(mockExec).toHaveBeenCalledWith(
        'git',
        ['add', '--', 'src/a.ts', 'src/b.ts'],
        expect.any(Object)
      )
      expect(deps.logInfo).toHaveBeenCalledWith('Git: staged files', expect.any(Object))
    })

    it('does nothing for empty file list', () => {
      service.stageFiles('/test/repo', [])
      expect(mockExec).not.toHaveBeenCalled()
    })
  })

  describe('unstageFiles', () => {
    it('unstages specified files', () => {
      mockExec.mockReturnValueOnce('')
      service.unstageFiles('/test/repo', ['src/a.ts'])

      expect(mockExec).toHaveBeenCalledWith(
        'git',
        ['reset', 'HEAD', '--', 'src/a.ts'],
        expect.any(Object)
      )
    })

    it('does nothing for empty file list', () => {
      service.unstageFiles('/test/repo', [])
      expect(mockExec).not.toHaveBeenCalled()
    })
  })

  describe('commit', () => {
    it('commits and returns hash', () => {
      mockExec
        .mockReturnValueOnce('') // commit
        .mockReturnValueOnce('abc123def456\n') // rev-parse HEAD

      const hash = service.commit('/test/repo', 'feat: add stuff')

      expect(mockExec).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'feat: add stuff'],
        expect.any(Object)
      )
      expect(hash).toBe('abc123def456')
      expect(deps.logInfo).toHaveBeenCalledWith('Git: committed', expect.any(Object))
    })
  })

  describe('push', () => {
    it('pushes to default remote', () => {
      mockExec.mockReturnValueOnce('')
      service.push('/test/repo')

      expect(mockExec).toHaveBeenCalledWith('git', ['push'], expect.any(Object))
    })

    it('pushes to specified branch', () => {
      mockExec.mockReturnValueOnce('')
      service.push('/test/repo', 'feature/xyz')

      expect(mockExec).toHaveBeenCalledWith(
        'git',
        ['push', 'origin', 'feature/xyz'],
        expect.any(Object)
      )
    })
  })

  describe('pull', () => {
    it('pulls from remote', () => {
      mockExec.mockReturnValueOnce('')
      service.pull('/test/repo')

      expect(mockExec).toHaveBeenCalledWith('git', ['pull'], expect.any(Object))
    })
  })

  describe('getLog', () => {
    it('returns parsed commit entries', () => {
      const raw = [
        'abc123def456789',
        'abc123d',
        'John Doe',
        '2026-03-06T10:00:00Z',
        'feat: initial commit',
        'def456abc789012',
        'def456a',
        'Jane Doe',
        '2026-03-05T09:00:00Z',
        'fix: patch'
      ].join('\n')

      mockExec.mockReturnValueOnce(raw + '\n')

      const log = service.getLog('/test/repo', 10)

      expect(log).toHaveLength(2)
      expect(log[0]).toEqual({
        hash: 'abc123def456789',
        shortHash: 'abc123d',
        author: 'John Doe',
        date: '2026-03-06T10:00:00Z',
        message: 'feat: initial commit'
      })
      expect(log[1].message).toBe('fix: patch')
    })

    it('returns empty array for empty log', () => {
      mockExec.mockReturnValueOnce('')
      const log = service.getLog('/test/repo')
      expect(log).toEqual([])
    })
  })

  describe('getBranches', () => {
    it('returns current branch and all branches', () => {
      mockExec
        .mockReturnValueOnce('main\n') // rev-parse --abbrev-ref HEAD
        .mockReturnValueOnce('main\nfeature/a\nfeature/b\n') // branch --format

      const info = service.getBranches('/test/repo')

      expect(info.current).toBe('main')
      expect(info.branches).toEqual(['main', 'feature/a', 'feature/b'])
    })
  })

  describe('suggestCommitMessage', () => {
    it('suggests message based on staged files', () => {
      // getStagedFiles call
      mockExec.mockReturnValueOnce('M\tsrc/main/app.ts\nM\tsrc/main/index.ts\n')

      const msg = service.suggestCommitMessage('/test/repo')
      expect(msg).toContain('fix')
      expect(msg).toContain('2 files')
    })

    it('detects test files', () => {
      mockExec.mockReturnValueOnce('A\tsrc/main/app.test.ts\n')

      const msg = service.suggestCommitMessage('/test/repo')
      expect(msg).toContain('test')
    })

    it('detects docs files', () => {
      mockExec.mockReturnValueOnce('M\tREADME.md\n')

      const msg = service.suggestCommitMessage('/test/repo')
      expect(msg).toContain('docs')
    })

    it('detects new files as feat', () => {
      mockExec.mockReturnValueOnce('A\tsrc/renderer/NewWidget.tsx\n')

      const msg = service.suggestCommitMessage('/test/repo')
      expect(msg).toContain('feat')
    })

    it('returns empty string if no staged files', () => {
      mockExec.mockReturnValueOnce('')

      const msg = service.suggestCommitMessage('/test/repo')
      expect(msg).toBe('')
    })
  })
})
