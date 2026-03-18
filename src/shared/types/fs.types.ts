export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
}

export interface ReadDirRequest {
  repoPath: string
  dirPath: string
}

export interface ReadFileRequest {
  repoPath: string
  filePath: string
}

export interface ReadFileResult {
  content: string
  size: number
  isTruncated: boolean
  language: string
}
