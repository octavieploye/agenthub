import { useEffect, useState } from 'react'
import { useThemeStore } from '../../stores/theme-store'
import { getFileIcon } from '../repo-file-tree/file-icons'
import type { ReadFileResult } from '@shared/types/fs.types'

interface FilePreviewLayoutProps {
  filePath: string
  repoPath: string
  repoName: string
}

// Apply theme from URL param synchronously before first paint
const urlTheme = new URLSearchParams(window.location.search).get('theme')
if (urlTheme) {
  document.documentElement.setAttribute('data-theme', urlTheme)
}

function FilePreviewLayout({ filePath, repoPath, repoName }: FilePreviewLayoutProps): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme)
  const [file, setFile] = useState<ReadFileResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const fileName = filePath.split('/').pop() ?? filePath
  const icon = getFileIcon(fileName, 'file')

  // Keep theme in sync if store changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.agentHub.fs
      .readFile({ repoPath, filePath })
      .then((res) => {
        if (res.success) {
          setFile(res.data)
        } else {
          setError(res.error.message)
        }
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [repoPath, filePath])

  const handleCopy = (type: 'path' | 'contents'): void => {
    const text = type === 'path'
      ? (repoPath.endsWith('/') ? `${repoPath}${filePath}` : `${repoPath}/${filePath}`)
      : (file?.content ?? '')
    window.agentHub.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleOpenEditor = async (): Promise<void> => {
    const abs = repoPath.endsWith('/') ? `${repoPath}${filePath}` : `${repoPath}/${filePath}`
    try {
      await window.agentHub.system.openTerminal(`code "${abs}"`)
    } catch {
      handleCopy('path')
    }
  }

  const lineCount = file?.content.split('\n').length ?? 0

  return (
    <div className="flex flex-col h-screen w-screen bg-base-300" data-theme={urlTheme ?? theme}>
      {/* Header breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 border-b border-base-content/15 bg-base-200/50">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-base-content truncate">{fileName}</span>
        <span className="text-base-content/30 text-xs">{'>'}</span>
        <span className="text-xs text-base-content/50 truncate">{repoName}</span>
        <span className="text-base-content/30 text-xs">{'>'}</span>
        <span className="text-[11px] text-base-content/40 font-mono truncate flex-1">{filePath}</span>

        {/* Toolbar */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={() => handleCopy('path')}
            className="px-2 py-1 text-[11px] rounded hover:bg-base-content/10 transition-colors text-base-content/60"
            title="Copy file path"
          >
            {copied === 'path' ? 'Copied!' : 'Copy path'}
          </button>
          <button
            onClick={() => handleCopy('contents')}
            disabled={!file}
            className="px-2 py-1 text-[11px] rounded hover:bg-base-content/10 transition-colors text-base-content/60 disabled:opacity-30"
            title="Copy file contents"
          >
            {copied === 'contents' ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleOpenEditor}
            className="px-2 py-1 text-[11px] rounded hover:bg-base-content/10 transition-colors text-base-content/60"
            title="Open in VS Code"
          >
            Open in editor
          </button>
        </div>
      </div>

      {/* Code viewer */}
      <div className="flex-1 min-h-0 overflow-auto bg-base-300">
        {loading && (
          <div className="flex items-center gap-2 p-4 text-sm text-base-content/50">
            <span className="inline-block w-4 h-4 border-2 border-base-content/30 border-t-transparent rounded-full animate-spin" />
            Loading file...
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-error/70">{error}</div>
        )}

        {file && !loading && (
          <>
            {file.isTruncated && (
              <div className="px-4 py-1.5 bg-warning/10 text-warning text-[11px] border-b border-warning/20">
                File truncated — showing first 1 MB of {formatSize(file.size)}
              </div>
            )}
            <div className="flex text-[12px] font-mono leading-5">
              {/* Line numbers */}
              <div className="select-none text-right pr-3 pl-3 py-3 text-base-content/25 border-r border-base-content/10 shrink-0 bg-base-300">
                {file.content.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              {/* Code */}
              <pre className="py-3 px-4 flex-1 overflow-x-auto whitespace-pre text-base-content/80">
                {file.content}
              </pre>
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 shrink-0 border-t border-base-content/15 bg-base-200/50 text-[11px] text-base-content/40">
        {file && (
          <>
            <span className="px-1.5 py-0.5 rounded bg-base-content/10 text-base-content/50 font-medium">
              {file.language}
            </span>
            <span>{lineCount} lines</span>
            <span>{formatSize(file.size)}</span>
          </>
        )}
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default FilePreviewLayout
