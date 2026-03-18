import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { RepoConfig } from '@shared/types/config.types'
import RepoListItem from './RepoListItem'
import FolderColorPicker from './FolderColorPicker'

interface RepoSelectDropdownProps {
  repos: RepoConfig[]
  selectedRepoId: string
  onSelect: (repoId: string) => void
  onRemove: (repoId: string) => void
  onColorChange: (repoId: string, color: string) => void
  onCustomPath?: () => void
}

const MAX_RECENT = 3

export default function RepoSelectDropdown({
  repos,
  selectedRepoId,
  onSelect,
  onRemove,
  onColorChange,
  onCustomPath
}: RepoSelectDropdownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [colorPickerRepoId, setColorPickerRepoId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selectedRepo = repos.find((r) => r.id === selectedRepoId)

  // Sort repos into recent + all
  const { recentRepos, allRepos } = useMemo(() => {
    const withLastUsed = repos
      .filter((r) => r.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt! > a.lastUsedAt! ? 1 : -1))
      .slice(0, MAX_RECENT)
    const recentIds = new Set(withLastUsed.map((r) => r.id))
    const rest = repos
      .filter((r) => !recentIds.has(r.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { recentRepos: withLastUsed, allRepos: rest }
  }, [repos])

  // Filter by search
  const filterFn = useCallback(
    (repo: RepoConfig) => {
      if (!search) return true
      const q = search.toLowerCase()
      return repo.name.toLowerCase().includes(q) || repo.path.toLowerCase().includes(q)
    },
    [search]
  )

  const filteredRecent = useMemo(() => recentRepos.filter(filterFn), [recentRepos, filterFn])
  const filteredAll = useMemo(() => allRepos.filter(filterFn), [allRepos, filterFn])
  const flatList = useMemo(() => [...filteredRecent, ...filteredAll], [filteredRecent, filteredAll])

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 10)
      setSearch('')
      setHighlightIndex(0)
    }
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleSelect = useCallback(
    (repoId: string) => {
      onSelect(repoId)
      setIsOpen(false)
    },
    [onSelect]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, flatList.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && flatList[highlightIndex]) {
        e.preventDefault()
        handleSelect(flatList[highlightIndex].id)
      }
    },
    [flatList, highlightIndex, handleSelect]
  )

  const handleRemove = useCallback(
    (repoId: string) => {
      onRemove(repoId)
    },
    [onRemove]
  )

  const folderColor = selectedRepo?.glowColor || '#89b4fa'

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-base-200/50 border border-base-content/10 text-sm text-left hover:border-base-content/20 transition-colors"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {selectedRepo ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={folderColor} className="shrink-0">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <span className="font-semibold truncate">{selectedRepo.name}</span>
          </>
        ) : (
          <span className="text-base-content/50">Select repository...</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto shrink-0 text-base-content/40">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Floating panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="repo-dropdown-panel absolute z-50 mt-1 w-full min-w-[300px] rounded-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.08) 100%)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)',
            animation: 'dropdownOpen 150ms ease-out'
          }}
          role="listbox"
        >
          {/* Specular highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightIndex(0)
                }}
                onKeyDown={handleKeyDown}
                className="input input-bordered w-full rounded-xl bg-base-200/50 text-sm pl-9"
                role="searchbox"
                aria-controls="repo-listbox"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-[280px] overflow-y-auto px-1 pb-1" id="repo-listbox">
            {/* Recent section */}
            {filteredRecent.length > 0 && (
              <>
                <div className="text-[10px] text-base-content/40 uppercase tracking-wide px-3 py-1">RECENT</div>
                {filteredRecent.map((repo, i) => (
                  <div key={repo.id} className="relative">
                    <RepoListItem
                      repo={repo}
                      isSelected={repo.id === selectedRepoId}
                      isHighlighted={i === highlightIndex}
                      onSelect={handleSelect}
                      onRemove={handleRemove}
                      onRequestColorPicker={(repoId) => setColorPickerRepoId(repoId)}
                    />
                    {colorPickerRepoId === repo.id && (
                      <FolderColorPicker
                        currentColor={repo.glowColor || '#89b4fa'}
                        onSelect={(color) => onColorChange(repo.id, color)}
                        onClose={() => setColorPickerRepoId(null)}
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* All repos section */}
            {filteredAll.length > 0 && (
              <>
                <div className="text-[10px] text-base-content/40 uppercase tracking-wide px-3 py-1 mt-1">ALL REPOSITORIES</div>
                {filteredAll.map((repo, i) => (
                  <div key={repo.id} className="relative">
                    <RepoListItem
                      repo={repo}
                      isSelected={repo.id === selectedRepoId}
                      isHighlighted={i + filteredRecent.length === highlightIndex}
                      onSelect={handleSelect}
                      onRemove={handleRemove}
                      onRequestColorPicker={(repoId) => setColorPickerRepoId(repoId)}
                    />
                    {colorPickerRepoId === repo.id && (
                      <FolderColorPicker
                        currentColor={repo.glowColor || '#89b4fa'}
                        onSelect={(color) => onColorChange(repo.id, color)}
                        onClose={() => setColorPickerRepoId(null)}
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* No results */}
            {flatList.length === 0 && (
              <div className="text-xs text-base-content/40 text-center py-4">No repositories found</div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-3 py-2">
            <button
              type="button"
              className="text-xs text-base-content/50 hover:text-base-content transition-colors"
              onClick={() => {
                setIsOpen(false)
                onCustomPath?.()
              }}
            >
              Custom path...
            </button>
          </div>
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes dropdownOpen {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-transparency: reduce) {
          .repo-dropdown-panel {
            background: hsl(var(--b2)) !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }
      `}</style>
    </div>
  )
}
