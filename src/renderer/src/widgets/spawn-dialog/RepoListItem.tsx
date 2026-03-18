import { useState } from 'react'
import type { RepoConfig } from '@shared/types/config.types'

interface RepoListItemProps {
  repo: RepoConfig
  isSelected: boolean
  isHighlighted: boolean
  onSelect: (repoId: string) => void
  onRemove: (repoId: string) => void
  onRequestColorPicker: (repoId: string) => void
}

export default function RepoListItem({ repo, isSelected, isHighlighted, onSelect, onRemove, onRequestColorPicker }: RepoListItemProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const folderColor = repo.glowColor || '#89b4fa'

  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors ${
        isHighlighted ? 'bg-base-content/15' : hovered ? 'bg-base-content/10' : ''
      }`}
      onClick={() => onSelect(repo.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault()
        onRequestColorPicker(repo.id)
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={folderColor} className="shrink-0">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-base-content truncate">{repo.name}</div>
        <div className="text-xs text-base-content/50 truncate">{repo.path}</div>
      </div>
      {isSelected && (
        <svg data-testid="selected-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {hovered && !isSelected && (
        <button
          aria-label="Remove repository"
          className="text-base-content/30 hover:text-error transition-colors shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(repo.id)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}
