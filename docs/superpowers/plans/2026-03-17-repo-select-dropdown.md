# Repo Select Dropdown Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `<select>` in SpawnDialog with a command-palette style custom dropdown featuring liquid glass aesthetics, search/filter, color-coded folder icons, recent repos, and inline removal with undo.

**Architecture:** New `RepoSelectDropdown` component composed of `RepoListItem` and `FolderColorPicker` sub-components. Uses existing toast system for undo. New DB migration adds `last_used_at` column. Reuses existing `glowColor` field for folder icon color.

**Tech Stack:** React, Zustand, Tailwind CSS, DaisyUI, better-sqlite3

**Spec:** `docs/superpowers/specs/2026-03-17-repo-select-dropdown-design.md`

---

## Chunk 1: Data Layer

### Task 1: DB Migration — `last_used_at` column

**Files:**
- Create: `src/main/db/migrations/010-repo-last-used.sql`

- [ ] **Step 1: Create migration file**

```sql
ALTER TABLE repos ADD COLUMN last_used_at TEXT;
```

- [ ] **Step 2: Verify migration loads**

Run: `npx electron-rebuild` (if needed) or start the app and check logs for migration 010 applying.

- [ ] **Step 3: Commit**

```bash
git add src/main/db/migrations/010-repo-last-used.sql
git commit -m "feat(db): add last_used_at column to repos table"
```

---

### Task 2: Update RepoConfig type + queries

**Files:**
- Modify: `src/shared/types/config.types.ts`
- Modify: `src/main/db/queries/repos.queries.ts`

- [ ] **Step 1: Add `lastUsedAt` to RepoConfig**

In `src/shared/types/config.types.ts`, add to the `RepoConfig` interface:
```typescript
lastUsedAt?: string
```

- [ ] **Step 2: Add `updateRepoLastUsed` query**

In `src/main/db/queries/repos.queries.ts`, add:
```typescript
export function updateRepoLastUsed(db: Database, id: string): void {
  db.prepare('UPDATE repos SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id)
}

export function updateRepoGlowColor(db: Database, id: string, glowColor: string): void {
  db.prepare('UPDATE repos SET glow_color = ? WHERE id = ?').run(glowColor, id)
}
```

- [ ] **Step 3: Update `getAllRepos` to include `last_used_at`**

Verify the existing `getAllRepos` query already maps `last_used_at` → `lastUsedAt`. If not, update the row mapping to include it.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/config.types.ts src/main/db/queries/repos.queries.ts
git commit -m "feat(repos): add lastUsedAt field and update queries"
```

---

### Task 3: Update spawn flow to record `lastUsedAt`

**Files:**
- Modify: `src/main/services/agent-manager.ts`

- [ ] **Step 1: Import `updateRepoLastUsed`**

Add to imports in `agent-manager.ts`:
```typescript
import { getRepoById, getRepoByPath, insertRepo, updateRepoLastUsed } from '../db/queries/repos.queries'
```

- [ ] **Step 2: Call `updateRepoLastUsed` after successful spawn**

In `spawnAgent()`, after the agent is created and `repoId` is resolved, add:
```typescript
updateRepoLastUsed(db, repoId)
```

Place this right after `insertAgent()` returns successfully.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/agent-manager.ts
git commit -m "feat(spawn): update repo lastUsedAt on agent spawn"
```

---

### Task 4: Add IPC for `updateRepoGlowColor`

**Files:**
- Modify: `src/main/ipc/` (wherever DB IPC handlers are registered)
- Modify: `src/preload/index.ts`
- Modify: `src/shared/constants/ipc-channels.ts` (if new channel needed)

- [ ] **Step 1: Add IPC channel constant**

In `ipc-channels.ts`, under `DB`:
```typescript
UPDATE_REPO_COLOR: 'db:update-repo-color'
```

- [ ] **Step 2: Register IPC handler**

In the DB IPC handler file, add handler:
```typescript
ipcMain.handle(IPC_CHANNELS.DB.UPDATE_REPO_COLOR, (_event, repoId: string, color: string) => {
  updateRepoGlowColor(getDb(), repoId, color)
  return { success: true }
})
```

- [ ] **Step 3: Expose in preload**

In `src/preload/index.ts`, add to `db` object:
```typescript
updateRepoColor: (repoId: string, color: string) => ipcRenderer.invoke(IPC_CHANNELS.DB.UPDATE_REPO_COLOR, repoId, color)
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/constants/ipc-channels.ts src/preload/index.ts src/main/ipc/
git commit -m "feat(ipc): add updateRepoColor IPC bridge"
```

---

## Chunk 2: Renderer Components

### Task 5: `RepoListItem` component

**Files:**
- Create: `src/renderer/src/widgets/spawn-dialog/RepoListItem.tsx`

- [ ] **Step 1: Write failing test**

Create `src/renderer/src/widgets/spawn-dialog/__tests__/RepoListItem.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RepoListItem from '../RepoListItem'

const mockRepo = {
  id: 'repo-1',
  name: 'my-project',
  path: '/Users/dev/my-project',
  glowColor: '#89b4fa',
  createdAt: '2026-01-01T00:00:00Z'
}

describe('RepoListItem', () => {
  it('renders repo name and path', () => {
    render(<RepoListItem repo={mockRepo} isSelected={false} isHighlighted={false} onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    expect(screen.getByText('my-project')).toBeInTheDocument()
    expect(screen.getByText('/Users/dev/my-project')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<RepoListItem repo={mockRepo} isSelected={false} isHighlighted={false} onSelect={onSelect} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('my-project'))
    expect(onSelect).toHaveBeenCalledWith('repo-1')
  })

  it('shows remove button on hover', async () => {
    render(<RepoListItem repo={mockRepo} isSelected={false} isHighlighted={false} onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    const item = screen.getByText('my-project').closest('[role="option"]')!
    fireEvent.mouseEnter(item)
    expect(screen.getByLabelText('Remove repository')).toBeInTheDocument()
  })

  it('shows checkmark when selected', () => {
    render(<RepoListItem repo={mockRepo} isSelected={true} isHighlighted={false} onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    expect(screen.getByTestId('selected-check')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/widgets/spawn-dialog/__tests__/RepoListItem.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement RepoListItem**

Create `src/renderer/src/widgets/spawn-dialog/RepoListItem.tsx`:

```tsx
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
      }
    >
      {/* Colored folder icon */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill={folderColor} className="shrink-0">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>

      {/* Name + path */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-base-content truncate">{repo.name}</div>
        <div className="text-xs text-base-content/50 truncate">{repo.path}</div>
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <svg data-testid="selected-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}

      {/* Remove button — hover only */}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/widgets/spawn-dialog/__tests__/RepoListItem.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/widgets/spawn-dialog/RepoListItem.tsx src/renderer/src/widgets/spawn-dialog/__tests__/RepoListItem.test.tsx
git commit -m "feat(spawn): add RepoListItem component with folder icon and removal"
```

---

### Task 6: `FolderColorPicker` component

**Files:**
- Create: `src/renderer/src/widgets/spawn-dialog/FolderColorPicker.tsx`

- [ ] **Step 1: Write failing test**

Create `src/renderer/src/widgets/spawn-dialog/__tests__/FolderColorPicker.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FolderColorPicker from '../FolderColorPicker'

describe('FolderColorPicker', () => {
  it('renders color swatches from palette', () => {
    render(<FolderColorPicker currentColor="#89b4fa" onSelect={vi.fn()} onClose={vi.fn()} />)
    const swatches = screen.getAllByRole('button')
    expect(swatches.length).toBeGreaterThanOrEqual(8)
  })

  it('calls onSelect with chosen color', () => {
    const onSelect = vi.fn()
    render(<FolderColorPicker currentColor="#89b4fa" onSelect={onSelect} onClose={vi.fn()} />)
    const swatches = screen.getAllByRole('button')
    fireEvent.click(swatches[2])
    expect(onSelect).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/widgets/spawn-dialog/__tests__/FolderColorPicker.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement FolderColorPicker**

Create `src/renderer/src/widgets/spawn-dialog/FolderColorPicker.tsx`:

```tsx
import { AGENT_COLOR_PALETTE } from '@shared/constants/defaults'

interface FolderColorPickerProps {
  currentColor: string
  onSelect: (color: string) => void
  onClose: () => void
}

export default function FolderColorPicker({ currentColor, onSelect, onClose }: FolderColorPickerProps): React.JSX.Element {
  return (
    <div
      className="absolute z-10 p-2 rounded-xl shadow-lg border border-white/15 backdrop-blur-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.08) 100%)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap gap-1.5 max-w-[140px]">
        {AGENT_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              currentColor === color ? 'border-base-content scale-110' : 'border-transparent hover:border-base-content/30'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => {
              onSelect(color)
              onClose()
            }}
          />
        ))}
      </div>
      <input
        type="color"
        value={currentColor}
        onChange={(e) => {
          onSelect(e.target.value)
          onClose()
        }}
        className="w-full h-5 mt-1.5 rounded cursor-pointer border-0 p-0"
        title="Custom color"
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/widgets/spawn-dialog/__tests__/FolderColorPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/widgets/spawn-dialog/FolderColorPicker.tsx src/renderer/src/widgets/spawn-dialog/__tests__/FolderColorPicker.test.tsx
git commit -m "feat(spawn): add FolderColorPicker component"
```

---

### Task 7: `RepoSelectDropdown` main component

**Files:**
- Create: `src/renderer/src/widgets/spawn-dialog/RepoSelectDropdown.tsx`

- [ ] **Step 1: Write failing test**

Create `src/renderer/src/widgets/spawn-dialog/__tests__/RepoSelectDropdown.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RepoSelectDropdown from '../RepoSelectDropdown'

const mockRepos = [
  { id: 'r1', name: 'alpha-proj', path: '/dev/alpha', glowColor: '#89b4fa', createdAt: '2026-01-01', lastUsedAt: '2026-03-17T10:00:00Z' },
  { id: 'r2', name: 'beta-proj', path: '/dev/beta', glowColor: '#a6e3a1', createdAt: '2026-01-02' },
  { id: 'r3', name: 'gamma-proj', path: '/dev/gamma', glowColor: '#fab387', createdAt: '2026-01-03', lastUsedAt: '2026-03-16T08:00:00Z' },
]

describe('RepoSelectDropdown', () => {
  it('renders trigger with placeholder when no repo selected', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    expect(screen.getByText('Select repository...')).toBeInTheDocument()
  })

  it('opens panel and shows search on click', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument()
  })

  it('shows Recent section for repos with lastUsedAt', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByText('RECENT')).toBeInTheDocument()
  })

  it('filters repos by search text', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    fireEvent.change(screen.getByPlaceholderText('Search repositories...'), { target: { value: 'beta' } })
    expect(screen.getByText('beta-proj')).toBeInTheDocument()
    expect(screen.queryByText('alpha-proj')).not.toBeInTheDocument()
  })

  it('calls onSelect when a repo is clicked', () => {
    const onSelect = vi.fn()
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={onSelect} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    fireEvent.click(screen.getByText('beta-proj'))
    expect(onSelect).toHaveBeenCalledWith('r2')
  })

  it('shows selected repo name in trigger', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="r1" onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    expect(screen.getByText('alpha-proj')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByPlaceholderText('Search repositories...'), { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search repositories...')).not.toBeInTheDocument()
  })

  it('shows Custom path footer option', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByText('Custom path...')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/widgets/spawn-dialog/__tests__/RepoSelectDropdown.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement RepoSelectDropdown**

Create `src/renderer/src/widgets/spawn-dialog/RepoSelectDropdown.tsx`:

```tsx
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

  const handleSelect = useCallback(
    (repoId: string) => {
      onSelect(repoId)
      setIsOpen(false)
    },
    [onSelect]
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
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-base-300/50">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-base-content/40 shrink-0">
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
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/30"
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
                <div className="text-[10px] text-base-content/40 uppercase tracking-wide px-3 py-1">Recent</div>
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
                <div className="text-[10px] text-base-content/40 uppercase tracking-wide px-3 py-1 mt-1">All Repositories</div>
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

      {/* Animation keyframes injected via style tag */}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/widgets/spawn-dialog/__tests__/RepoSelectDropdown.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/widgets/spawn-dialog/RepoSelectDropdown.tsx src/renderer/src/widgets/spawn-dialog/__tests__/RepoSelectDropdown.test.tsx
git commit -m "feat(spawn): add RepoSelectDropdown with liquid glass and search"
```

---

## Chunk 3: Integration

### Task 8: Wire RepoSelectDropdown into SpawnDialog

**Files:**
- Modify: `src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx`

- [ ] **Step 1: Import RepoSelectDropdown**

At top of `SpawnDialog.tsx`, add:
```typescript
import RepoSelectDropdown from './RepoSelectDropdown'
```

- [ ] **Step 2: Add removal + color change handlers**

Inside the `SpawnDialog` component, before the return statement, add:

```typescript
const handleRemoveRepo = useCallback(async (repoId: string) => {
  const repo = repos.find((r) => r.id === repoId)
  if (!repo) return

  // Optimistic removal
  setRepos((prev) => prev.filter((r) => r.id !== repoId))
  if (selectedRepoId === repoId) setSelectedRepoId('')

  // Show undo toast using existing toast system
  const toastId = `undo-remove-${repoId}`
  const { addToast, dismissToast } = useNotificationStore.getState()
  let undone = false

  // Use 'warning' severity (5s auto-dismiss) to give time for undo
  addToast({
    id: toastId,
    severity: 'warning',
    title: 'Repository removed',
    message: `${repo.name} removed from list`,
    createdAt: Date.now(),
    actions: [{
      label: 'Undo',
      onClick: () => {
        undone = true
        dismissToast(toastId)
        setRepos((prev) => [...prev, repo].sort((a, b) => a.name.localeCompare(b.name)))
      }
    }]
  })

  // After 5 seconds (matching warning auto-dismiss), persist the deletion
  setTimeout(async () => {
    if (!undone) {
      try {
        await window.agentHub.db.removeRepo(repoId)
      } catch { /* already removed from UI */ }
    }
  }, 5000)
}, [repos, selectedRepoId])

const handleRepoColorChange = useCallback(async (repoId: string, color: string) => {
  setRepos((prev) => prev.map((r) => r.id === repoId ? { ...r, glowColor: color } : r))
  try {
    await window.agentHub.db.updateRepoColor(repoId, color)
  } catch { /* UI already updated */ }
}, [])
```

- [ ] **Step 3: Add import for notification store**

```typescript
import { useNotificationStore } from '@renderer/stores/notification-store'
```

- [ ] **Step 4: Replace the native `<select>` block**

Replace lines 339-358 (the `{repos.length > 0 && (...)}` block containing the native `<select>`) with:

```tsx
<div>
  <label className="text-xs text-base-content/50 mb-1 block">Select Repository</label>
  <RepoSelectDropdown
    repos={repos}
    selectedRepoId={selectedRepoId}
    onSelect={(repoId) => {
      setSelectedRepoId(repoId)
      if (repoId) setCustomCwd('')
    }}
    onRemove={handleRemoveRepo}
    onColorChange={handleRepoColorChange}
    onCustomPath={() => setSelectedRepoId('')}
  />
</div>
```

Note: Remove the `repos.length > 0` guard — the dropdown should always show so users can see "Custom path..." even with no repos.

- [ ] **Step 5: Run existing SpawnDialog tests**

Run: `npx vitest run src/renderer/src/widgets/spawn-dialog/`
Expected: PASS (existing tests may need minor updates for the changed DOM structure)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx
git commit -m "feat(spawn): integrate RepoSelectDropdown replacing native select"
```

---

### Task 9: Type-check and final verification

**Files:** All modified files

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Manual test**

1. Open SpawnDialog
2. Verify liquid glass dropdown appears below trigger
3. Type in search — repos filter
4. Recent repos appear at top
5. Right-click folder icon — color picker appears
6. Click X on repo — removed with undo toast
7. Click Undo — repo restored
8. Select repo — dropdown closes, trigger shows selected repo
9. Click "Custom path..." — dropdown closes, manual input appears

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(spawn): repo select dropdown with liquid glass, search, and undo removal"
```
