import { useState, useCallback, useEffect, useRef } from 'react'
import FileTreeNode from './FileTreeNode'
import type { FileTreeNode as FileTreeNodeType } from '@shared/types/fs.types'

interface RepoFileTreeProps {
  repoPath: string
}

const MAX_ENTRIES = 200

function RepoFileTree({ repoPath }: RepoFileTreeProps): React.JSX.Element {
  const [dirs, setDirs] = useState<Record<string, FileTreeNodeType[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const filterRef = useRef<HTMLInputElement>(null)

  const loadDir = useCallback(async (dirPath: string) => {
    if (dirs[dirPath] || loading.has(dirPath)) return // already loaded or in-flight

    setLoading((prev) => new Set(prev).add(dirPath))
    try {
      const response = await window.agentHub.fs.readDir({ repoPath, dirPath })
      if (response.success) {
        setDirs((prev) => ({ ...prev, [dirPath]: response.data }))
      } else {
        setErrors((prev) => ({ ...prev, [dirPath]: 'success' in response ? 'Failed to read' : 'Error' }))
      }
    } catch {
      setErrors((prev) => ({ ...prev, [dirPath]: 'Could not read directory' }))
    } finally {
      setLoading((prev) => {
        const next = new Set(prev)
        next.delete(dirPath)
        return next
      })
    }
  }, [repoPath, dirs, loading])

  // Load root on mount
  useEffect(() => {
    loadDir('')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleDir = useCallback((dirPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
        if (!dirs[dirPath]) {
          loadDir(dirPath)
        }
      }
      return next
    })
  }, [dirs, loadDir])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      filterRef.current?.focus()
    }
  }, [])

  const renderNodes = (dirPath: string, depth: number): React.JSX.Element[] => {
    const nodes = dirs[dirPath]
    if (!nodes) return []

    const filterLower = filter.toLowerCase()
    let filtered = filterLower
      ? nodes.filter((n) => n.name.toLowerCase().includes(filterLower))
      : nodes

    const truncated = filtered.length > MAX_ENTRIES
    if (truncated) filtered = filtered.slice(0, MAX_ENTRIES)

    const elements: React.JSX.Element[] = []

    for (const node of filtered) {
      elements.push(
        <FileTreeNode
          key={node.path}
          node={node}
          repoPath={repoPath}
          depth={depth}
          isExpanded={expanded.has(node.path)}
          isLoading={loading.has(node.path)}
          onToggleDir={handleToggleDir}
        />
      )

      if (node.type === 'directory' && expanded.has(node.path)) {
        if (errors[node.path]) {
          elements.push(
            <div
              key={`error-${node.path}`}
              className="text-[10px] text-error/60 pl-4"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
            >
              {errors[node.path]}
            </div>
          )
        } else {
          elements.push(...renderNodes(node.path, depth + 1))
        }
      }
    }

    if (truncated) {
      elements.push(
        <div
          key={`truncated-${dirPath}`}
          className="text-[10px] text-base-content/40 italic"
          style={{ paddingLeft: `${depth * 16 + 24}px` }}
        >
          {MAX_ENTRIES} of {nodes.length} items — use filter to narrow
        </div>
      )
    }

    return elements
  }

  return (
    <div
      role="tree"
      aria-label="File tree"
      onKeyDown={handleKeyDown}
      className="overflow-hidden"
    >
      {/* Filter input */}
      <div className="px-2 py-1.5">
        <input
          ref={filterRef}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files…"
          aria-label="Filter files in repository"
          className="w-full border border-base-content/15 bg-base-content/5 text-[11px] font-mono rounded px-2 py-1 outline-none focus:border-base-content/30 transition-colors"
        />
      </div>

      {/* Tree */}
      <div className="overflow-y-auto max-h-[400px] pb-1">
        {loading.has('') && !dirs[''] && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-base-content/50">
            <span className="inline-block w-3 h-3 border border-base-content/30 border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        )}
        {errors[''] && (
          <div className="px-3 py-2 text-[10px] text-error/60">
            {errors['']}
          </div>
        )}
        {dirs[''] && renderNodes('', 0)}
      </div>
    </div>
  )
}

export default RepoFileTree
