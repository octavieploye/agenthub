import { readdir, stat, realpath, open } from 'fs/promises'
import { join, resolve, extname } from 'path'
import type { FileTreeNode, ReadFileResult } from '../../shared/types/fs.types'

const MAX_FILE_SIZE = 1_048_576 // 1MB

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.avif',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.flac',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.exe', '.dll', '.so', '.dylib',
  '.sqlite', '.db', '.bin', '.dat'
])

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.cs': 'csharp',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.json': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.sql': 'sql',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.dockerfile': 'dockerfile',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.vue': 'vue',
  '.svelte': 'svelte'
}

export interface FsServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
  getAllRepoPaths: () => string[]
}

export class FsService {
  private deps: FsServiceDeps

  constructor(deps: FsServiceDeps) {
    this.deps = deps
  }

  private async assertWithinRepo(repoPath: string, targetPath: string): Promise<string> {
    // Resolve symlinks on repo root itself to prevent TOCTOU bypass
    const resolvedRepo = await realpath(resolve(repoPath))
    const resolvedTarget = resolve(targetPath)

    if (!resolvedTarget.startsWith(resolvedRepo + '/') && resolvedTarget !== resolvedRepo) {
      throw new Error('Path traversal detected: target is outside repo root')
    }

    // Check symlink doesn't escape
    try {
      const realTarget = await realpath(resolvedTarget)
      if (!realTarget.startsWith(resolvedRepo + '/') && realTarget !== resolvedRepo) {
        throw new Error('Symlink escapes repo root')
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('Path does not exist')
      }
      throw err
    }

    return resolvedTarget
  }

  private validateRepoPath(repoPath: string): void {
    const resolved = resolve(repoPath)
    const knownPaths = this.deps.getAllRepoPaths()
    if (!knownPaths.some((p) => resolve(p) === resolved)) {
      throw new Error('Repo path is not a registered repository')
    }
  }

  async readDir(repoPath: string, dirPath: string): Promise<FileTreeNode[]> {
    this.validateRepoPath(repoPath)
    const targetDir = join(repoPath, dirPath)
    const resolvedTarget = await this.assertWithinRepo(repoPath, targetDir)

    const entries = await readdir(resolvedTarget, { withFileTypes: true })

    const nodes: FileTreeNode[] = []
    for (const entry of entries) {
      if (entry.name === '.git') continue

      const relativePath = dirPath ? join(dirPath, entry.name) : entry.name
      const isDir = entry.isDirectory()

      const node: FileTreeNode = {
        name: entry.name,
        path: relativePath,
        type: isDir ? 'directory' : 'file'
      }

      if (!isDir) {
        try {
          const s = await stat(join(resolvedTarget, entry.name))
          node.size = s.size
        } catch {
          // skip size on error
        }
      }

      nodes.push(node)
    }

    // Sort: directories first, then alphabetical
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    this.deps.logInfo('FsService: readDir', { repoPath, dirPath, count: nodes.length })
    return nodes
  }

  async readFile(repoPath: string, filePath: string): Promise<ReadFileResult> {
    this.validateRepoPath(repoPath)
    const targetFile = join(repoPath, filePath)
    const resolvedTarget = await this.assertWithinRepo(repoPath, targetFile)

    const ext = extname(filePath).toLowerCase()
    const language = LANGUAGE_MAP[ext] ?? 'plaintext'

    const fileStat = await stat(resolvedTarget)

    if (BINARY_EXTENSIONS.has(ext)) {
      return {
        content: `[Binary file: ${fileStat.size} bytes]`,
        size: fileStat.size,
        isTruncated: false,
        language: 'binary'
      }
    }

    const isTruncated = fileStat.size > MAX_FILE_SIZE
    const readSize = Math.min(fileStat.size, MAX_FILE_SIZE)

    // Read only up to MAX_FILE_SIZE bytes to avoid memory spikes on huge files
    const buffer = Buffer.alloc(readSize)
    const fh = await open(resolvedTarget, 'r')
    try {
      await fh.read(buffer, 0, readSize, 0)
    } finally {
      await fh.close()
    }
    const content = buffer.toString('utf-8')

    this.deps.logInfo('FsService: readFile', { repoPath, filePath, size: fileStat.size, isTruncated })

    return { content, size: fileStat.size, isTruncated, language }
  }
}
