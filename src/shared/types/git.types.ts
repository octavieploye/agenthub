export type GitFileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | '?'

export interface GitFileChange {
  path: string
  status: GitFileStatus
}

export interface GitRepoStatus {
  repoPath: string
  branch: string
  ahead: number
  behind: number
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  untracked: string[]
  isDirty: boolean
}

export interface GitCommitEntry {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
}

export interface GitDiffResult {
  repoPath: string
  diff: string
  stats: {
    insertions: number
    deletions: number
    filesChanged: number
  }
}

export interface GitBranchInfo {
  current: string
  branches: string[]
}
