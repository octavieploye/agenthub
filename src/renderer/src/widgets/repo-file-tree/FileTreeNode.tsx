import { useRef } from 'react'
import { getFileIcon } from './file-icons'
import { useThemeStore } from '../../stores/theme-store'
import type { FileTreeNode as FileTreeNodeType } from '@shared/types/fs.types'

interface FileTreeNodeProps {
  node: FileTreeNodeType
  repoPath: string
  depth: number
  isExpanded: boolean
  isLoading: boolean
  onToggleDir: (dirPath: string) => void
}

function FileTreeNode({ node, repoPath, depth, isExpanded, isLoading, onToggleDir }: FileTreeNodeProps): React.JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null)
  const theme = useThemeStore((s) => s.theme)

  const icon = getFileIcon(node.name, node.type)
  const isDir = node.type === 'directory'

  const handleClick = (): void => {
    if (isDir) {
      onToggleDir(node.path)
    } else {
      window.agentHub.windows.createFilePreview({ filePath: node.path, repoPath, theme })
    }
  }

  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-expanded={isDir ? isExpanded : undefined}
      aria-level={depth + 1}
      onClick={handleClick}
      className="flex items-center h-7 cursor-pointer hover:bg-base-content/5 transition-colors select-none"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {depth > 0 && (
        <div
          className="absolute border-l border-base-content/10"
          style={{ left: `${depth * 16}px`, top: 0, bottom: 0 }}
        />
      )}

      {/* Chevron for directories */}
      <span className="w-4 shrink-0 text-center text-[10px] text-base-content/40">
        {isDir && !isLoading && (
          <span
            className={`inline-block transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
        )}
        {isDir && isLoading && (
          <span className="inline-block w-3 h-3 border border-base-content/30 border-t-transparent rounded-full animate-spin" />
        )}
      </span>

      {/* Icon */}
      <span className="w-5 shrink-0 text-center text-[13px]">{icon}</span>

      {/* Name */}
      <span className="text-xs truncate flex-1 text-base-content/80">
        {node.name}
      </span>

      {/* Size for files */}
      {!isDir && node.size !== undefined && (
        <span className="text-[10px] text-base-content/30 pr-2 shrink-0">
          {formatSize(node.size)}
        </span>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}K`
  return `${(bytes / 1048576).toFixed(1)}M`
}

export default FileTreeNode
