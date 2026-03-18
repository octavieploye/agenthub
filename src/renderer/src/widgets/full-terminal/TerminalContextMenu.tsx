import { useEffect, useRef } from 'react'

interface TerminalContextMenuProps {
  position: { x: number; y: number }
  hasSelection: boolean
  onCopy: () => void
  onPaste: () => void
  onSearch: () => void
  onClear: () => void
  onSelectAll: () => void
  onClose: () => void
}

function TerminalContextMenu({
  position,
  hasSelection,
  onCopy,
  onPaste,
  onSearch,
  onClear,
  onSelectAll,
  onClose
}: TerminalContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click or escape
  useEffect(() => {
    const handleClick = (): void => onClose()
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    // Delay to avoid immediate close from the contextmenu event
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick)
      window.addEventListener('keydown', handleKey)
    }, 50)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Keep menu within viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`
    }
  }, [position])

  const items = [
    { label: 'Copy', shortcut: '⌘C', onClick: onCopy, enabled: hasSelection },
    { label: 'Paste', shortcut: '⌘V', onClick: onPaste, enabled: true },
    { label: 'Select All', shortcut: '⌘A', onClick: onSelectAll, enabled: true },
    { type: 'separator' as const },
    { label: 'Search', shortcut: '⌘F', onClick: onSearch, enabled: true },
    { label: 'Clear', shortcut: '', onClick: onClear, enabled: true }
  ]

  return (
    <div
      ref={menuRef}
      className="dropdown-panel fixed min-w-[180px]"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, i) => {
        if ('type' in item && item.type === 'separator') {
          return <div key={i} className="border-t border-base-content/10 my-1" />
        }
        return (
          <button
            key={i}
            onClick={item.onClick}
            disabled={!item.enabled}
            className="dropdown-item w-full text-left text-sm flex items-center justify-between disabled:opacity-40 disabled:cursor-default"
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-base-content/40 ml-4">{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default TerminalContextMenu
