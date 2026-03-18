import { useEffect, useRef, useState } from 'react'

interface FileActionPopoverProps {
  filePath: string
  repoPath: string
  anchorRect: DOMRect
  onClose: () => void
}

function FileActionPopover({ filePath, repoPath, anchorRect, onClose }: FileActionPopoverProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const absolutePath = repoPath.endsWith('/') ? `${repoPath}${filePath}` : `${repoPath}/${filePath}`

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const handleCopy = (): void => {
    window.agentHub.clipboard.writeText(absolutePath)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleOpenEditor = async (): Promise<void> => {
    try {
      await window.agentHub.system.openTerminal(`code "${absolutePath}"`)
    } catch {
      // fallback: just copy path
      window.agentHub.clipboard.writeText(absolutePath)
    }
    onClose()
  }

  const handleCopyContents = async (): Promise<void> => {
    try {
      const response = await window.agentHub.fs.readFile({ repoPath, filePath })
      if (response.success) {
        // Open preview in a simple alert-like modal for now
        // This could be enhanced to a proper viewer
        const content = response.data.content.slice(0, 2000)
        const truncated = response.data.isTruncated || response.data.content.length > 2000
        window.agentHub.clipboard.writeText(content)
        // For MVP: copy content to clipboard and notify
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
          onClose()
        }, 1500)
      }
    } catch {
      // ignore
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[160px] py-1 rounded-lg border border-base-content/15 bg-base-300 shadow-xl"
      style={{
        top: anchorRect.bottom + 4,
        left: anchorRect.left
      }}
    >
      <button
        role="menuitem"
        onClick={handleCopy}
        className="w-full px-3 py-1.5 text-left text-xs hover:bg-base-content/10 flex items-center gap-2 transition-colors"
      >
        <span className="w-4 text-center">{copied ? '✓' : '📋'}</span>
        {copied ? 'Copied!' : 'Copy path'}
      </button>
      <button
        role="menuitem"
        onClick={handleOpenEditor}
        className="w-full px-3 py-1.5 text-left text-xs hover:bg-base-content/10 flex items-center gap-2 transition-colors"
      >
        <span className="w-4 text-center">📝</span>
        Open in editor
      </button>
      <button
        role="menuitem"
        onClick={handleCopyContents}
        className="w-full px-3 py-1.5 text-left text-xs hover:bg-base-content/10 flex items-center gap-2 transition-colors"
      >
        <span className="w-4 text-center">👁️</span>
        Copy contents
      </button>
    </div>
  )
}

export default FileActionPopover
