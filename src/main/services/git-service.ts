import { execFileSync } from 'child_process'
import type {
  GitRepoStatus,
  GitFileChange,
  GitCommitEntry,
  GitDiffResult,
  GitBranchInfo,
  GitFileStatus
} from '../../shared/types/git.types'

export interface GitServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
}

export class GitService {
  private deps: GitServiceDeps

  constructor(deps: GitServiceDeps) {
    this.deps = deps
  }

  private exec(args: string[], cwd: string): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', timeout: 30_000 }).trim()
  }

  getStatus(repoPath: string): GitRepoStatus {
    const branch = this.getCurrentBranch(repoPath)
    const { ahead, behind } = this.getAheadBehind(repoPath)
    const staged = this.getStagedFiles(repoPath)
    const unstaged = this.getUnstagedFiles(repoPath)
    const untracked = this.getUntrackedFiles(repoPath)
    const isDirty = staged.length > 0 || unstaged.length > 0 || untracked.length > 0

    return { repoPath, branch, ahead, behind, staged, unstaged, untracked, isDirty }
  }

  getDiff(repoPath: string, staged: boolean = false): GitDiffResult {
    const args = staged ? ['diff', '--cached'] : ['diff']
    const diff = this.exec(args, repoPath)
    const stats = this.parseDiffStats(repoPath, staged)
    return { repoPath, diff, stats }
  }

  stageFiles(repoPath: string, files: string[]): void {
    if (files.length === 0) return
    this.exec(['add', '--', ...files], repoPath)
    this.deps.logInfo('Git: staged files', { repoPath, count: files.length })
  }

  unstageFiles(repoPath: string, files: string[]): void {
    if (files.length === 0) return
    this.exec(['reset', 'HEAD', '--', ...files], repoPath)
    this.deps.logInfo('Git: unstaged files', { repoPath, count: files.length })
  }

  commit(repoPath: string, message: string): string {
    this.exec(['commit', '-m', message], repoPath)
    const hash = this.exec(['rev-parse', 'HEAD'], repoPath)
    this.deps.logInfo('Git: committed', { repoPath, hash: hash.slice(0, 8) })
    return hash
  }

  push(repoPath: string, branch?: string): void {
    const args = branch ? ['push', 'origin', branch] : ['push']
    this.exec(args, repoPath)
    this.deps.logInfo('Git: pushed', { repoPath, branch })
  }

  pull(repoPath: string): void {
    this.exec(['pull'], repoPath)
    this.deps.logInfo('Git: pulled', { repoPath })
  }

  getLog(repoPath: string, limit: number = 20): GitCommitEntry[] {
    const format = '%H%n%h%n%an%n%aI%n%s'
    const raw = this.exec(['log', `--max-count=${limit}`, `--format=${format}`], repoPath)
    if (!raw) return []

    const lines = raw.split('\n')
    const entries: GitCommitEntry[] = []
    for (let i = 0; i + 4 < lines.length; i += 5) {
      entries.push({
        hash: lines[i],
        shortHash: lines[i + 1],
        author: lines[i + 2],
        date: lines[i + 3],
        message: lines[i + 4]
      })
    }
    return entries
  }

  getBranches(repoPath: string): GitBranchInfo {
    const current = this.getCurrentBranch(repoPath)
    const raw = this.exec(['branch', '--format=%(refname:short)'], repoPath)
    const branches = raw ? raw.split('\n').filter(Boolean) : []
    return { current, branches }
  }

  suggestCommitMessage(repoPath: string): string {
    const staged = this.getStagedFiles(repoPath)
    if (staged.length === 0) return ''

    const types = new Set<string>()
    const scopes = new Set<string>()

    for (const file of staged) {
      const ext = file.path.split('.').pop() ?? ''
      const dir = file.path.split('/')[0] ?? ''

      if (file.path.includes('.test.') || file.path.includes('.spec.') || dir === 'tests') {
        types.add('test')
      } else if (ext === 'md' || ext === 'txt' || ext === 'rst') {
        types.add('docs')
      } else if (file.status === 'A') {
        types.add('feat')
      } else if (file.status === 'D') {
        types.add('chore')
      } else {
        types.add('fix')
      }

      if (dir === 'src') {
        const subdir = file.path.split('/')[1] ?? ''
        if (subdir) scopes.add(subdir)
      }
    }

    const type = types.size === 1 ? [...types][0] : 'feat'
    const scope = scopes.size === 1 ? [...scopes][0] : scopes.size > 1 ? 'multi' : ''
    const prefix = scope ? `${type}(${scope})` : type
    const fileCount = staged.length
    const verb =
      staged.every((f) => f.status === 'A')
        ? 'add'
        : staged.every((f) => f.status === 'D')
          ? 'remove'
          : 'update'

    return `${prefix}: ${verb} ${fileCount} file${fileCount !== 1 ? 's' : ''}`
  }

  private getCurrentBranch(repoPath: string): string {
    return this.exec(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath)
  }

  private getAheadBehind(repoPath: string): { ahead: number; behind: number } {
    try {
      const raw = this.exec(['rev-list', '--left-right', '--count', '@{u}...HEAD'], repoPath)
      const [behind, ahead] = raw.split('\t').map(Number)
      return { ahead: ahead ?? 0, behind: behind ?? 0 }
    } catch {
      return { ahead: 0, behind: 0 }
    }
  }

  private getStagedFiles(repoPath: string): GitFileChange[] {
    const raw = this.exec(['diff', '--cached', '--name-status'], repoPath)
    return this.parseNameStatus(raw)
  }

  private getUnstagedFiles(repoPath: string): GitFileChange[] {
    const raw = this.exec(['diff', '--name-status'], repoPath)
    return this.parseNameStatus(raw)
  }

  private getUntrackedFiles(repoPath: string): string[] {
    const raw = this.exec(['ls-files', '--others', '--exclude-standard'], repoPath)
    return raw ? raw.split('\n').filter(Boolean) : []
  }

  private parseNameStatus(raw: string): GitFileChange[] {
    if (!raw) return []
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [status, ...pathParts] = line.split('\t')
        return {
          status: (status?.charAt(0) ?? 'M') as GitFileStatus,
          path: pathParts.join('\t')
        }
      })
  }

  private parseDiffStats(
    repoPath: string,
    staged: boolean
  ): { insertions: number; deletions: number; filesChanged: number } {
    const args = staged ? ['diff', '--cached', '--shortstat'] : ['diff', '--shortstat']
    const raw = this.exec(args, repoPath)
    if (!raw) return { insertions: 0, deletions: 0, filesChanged: 0 }

    const filesMatch = raw.match(/(\d+) file/)
    const insMatch = raw.match(/(\d+) insertion/)
    const delMatch = raw.match(/(\d+) deletion/)

    return {
      filesChanged: filesMatch ? Number(filesMatch[1]) : 0,
      insertions: insMatch ? Number(insMatch[1]) : 0,
      deletions: delMatch ? Number(delMatch[1]) : 0
    }
  }
}
