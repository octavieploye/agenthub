# Kanban Card Detail Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hover-triggered portal popover to KanbanCard that shows and edits all task fields.

**Architecture:** On 650ms card hover, capture `getBoundingClientRect`, compute left/right placement, and render `KanbanCardPopover` via `createPortal` into `document.body`. The popover stays open while the mouse is inside it; a 150ms close delay lets the mouse travel between card and popup without flicker. Inline edit mode suppresses the popover entirely.

**Tech Stack:** React 18 (`createPortal`, `useRef`, `useState`, `useEffect`), vitest, @testing-library/react, DaisyUI, Tailwind CSS.

## Global Constraints

- All new components use DaisyUI utility classes (no custom CSS files).
- No new stores, no new IPC channels — all data flows through existing `onEdit: (input: UpdateTaskInput) => void` and `onDelete: () => void` props.
- TypeScript strict — no `any`, no untyped assignments.
- Tests co-located with components (`*.test.tsx` beside `*.tsx`).
- Never mock stores or internal modules with `vi.mock()`. Use `vi.fn()` for callback spies and `vi.useFakeTimers()` for timer control only.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/renderer/src/widgets/kanban/KanbanCardPopover.tsx` | **Create** | Portal-rendered popup: all fields, Save/Cancel, mouse callbacks |
| `src/renderer/src/widgets/kanban/KanbanCardPopover.test.tsx` | **Create** | Unit tests: field rendering, save, close, mouse events |
| `src/renderer/src/widgets/kanban/KanbanCard.tsx` | **Modify** | Add hover timers, card ref, popover state, suppress rules, remove note tooltip |
| `src/renderer/src/widgets/kanban/KanbanCard.test.tsx` | **Create** | Hover timer tests: open delay, cancel on leave, suppress in edit mode |

`KanbanBoard.tsx`, `KanbanColumn.tsx`, `task.types.ts` — **no changes**.

---

### Task 1: KanbanCardPopover component + tests

**Files:**
- Create: `src/renderer/src/widgets/kanban/KanbanCardPopover.tsx`
- Create: `src/renderer/src/widgets/kanban/KanbanCardPopover.test.tsx`

**Interfaces:**
- Consumes: `TaskItem`, `UpdateTaskInput` from `@shared/types/task.types`
- Produces:
  ```typescript
  // Props consumed by KanbanCard in Task 2
  interface KanbanCardPopoverProps {
    task: TaskItem
    position: { top: number; left: number }
    onSave: (input: UpdateTaskInput) => void
    onClose: () => void
    onMouseEnter: () => void
    onMouseLeave: () => void
  }
  export function KanbanCardPopover(props: KanbanCardPopoverProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/src/widgets/kanban/KanbanCardPopover.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KanbanCardPopover } from './KanbanCardPopover'
import type { TaskItem } from '@shared/types/task.types'

const mockTask: TaskItem = {
  id: 'task-1',
  repoId: 'repo-1',
  title: 'Fix login bug',
  description: 'Users cannot log in after token refresh',
  priority: 2,
  status: 'backlog',
  category: 'backend',
  agentId: null,
  position: 0,
  sbarId: null,
  sprintName: 'Sprint 1',
  epicName: 'Auth Epic',
  projectId: null,
  sectionTargetDate: '2026-07-01',
  note: 'Check the JWT expiry logic',
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-21T00:00:00Z',
}

const defaultProps = {
  task: mockTask,
  position: { top: 100, left: 400 },
  onSave: vi.fn(),
  onClose: vi.fn(),
  onMouseEnter: vi.fn(),
  onMouseLeave: vi.fn(),
}

describe('KanbanCardPopover', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders all editable fields prefilled from task', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    expect(screen.getByDisplayValue('Fix login bug')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Users cannot log in after token refresh')).toBeInTheDocument()
    expect(screen.getByDisplayValue('backend')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Check the JWT expiry logic')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Auth Epic')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Sprint 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-07-01')).toBeInTheDocument()
  })

  it('calls onClose when ✕ is clicked', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Close popover'))
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onSave with updated title and then onClose when Save is clicked', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.change(screen.getByDisplayValue('Fix login bug'), { target: { value: 'Fix login bug v2' } })
    fireEvent.click(screen.getByText('Save'))
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fix login bug v2' })
    )
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('Save button is disabled and onSave not called when title is empty', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.change(screen.getByDisplayValue('Fix login bug'), { target: { value: '' } })
    const saveBtn = screen.getByText('Save')
    expect(saveBtn).toBeDisabled()
    fireEvent.click(saveBtn)
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  it('calls onMouseEnter and onMouseLeave on panel mouse events', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    const panel = screen.getByTestId('card-popover')
    fireEvent.mouseEnter(panel)
    expect(defaultProps.onMouseEnter).toHaveBeenCalledOnce()
    fireEvent.mouseLeave(panel)
    expect(defaultProps.onMouseLeave).toHaveBeenCalledOnce()
  })

  it('renders created and updated dates from task metadata', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    expect(screen.getByText(/Created:/)).toBeInTheDocument()
    expect(screen.getByText(/Updated:/)).toBeInTheDocument()
  })

  it('applies fixed position style from position prop', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    const panel = screen.getByTestId('card-popover')
    expect(panel).toHaveStyle({ top: '100px', left: '400px' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/renderer/src/widgets/kanban/KanbanCardPopover.test.tsx
```

Expected: FAIL — `Cannot find module './KanbanCardPopover'`

- [ ] **Step 3: Create KanbanCardPopover.tsx**

Create `src/renderer/src/widgets/kanban/KanbanCardPopover.tsx`:

```tsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskItem, TaskPriority, TaskStatus, UpdateTaskInput } from '@shared/types/task.types'
import { PRIORITY_LABEL, STATUS_LABEL, CATEGORY_LABEL, KNOWN_CATEGORIES } from '@shared/types/task.types'

interface KanbanCardPopoverProps {
  task: TaskItem
  position: { top: number; left: number }
  onSave: (input: UpdateTaskInput) => void
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function KanbanCardPopover({ task, position, onSave, onClose, onMouseEnter, onMouseLeave }: KanbanCardPopoverProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [category, setCategory] = useState(task.category ?? '')
  const [note, setNote] = useState(task.note ?? '')
  const [epicName, setEpicName] = useState(task.epicName ?? '')
  const [sprintName, setSprintName] = useState(task.sprintName ?? '')
  const [sectionTargetDate, setSectionTargetDate] = useState(task.sectionTargetDate ?? '')

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      category: category.trim() || null,
      note: note.trim() || null,
      epicName: epicName.trim() || null,
      sprintName: sprintName.trim() || null,
      sectionTargetDate: sectionTargetDate || null,
    })
    onClose()
  }

  const content = (
    <div
      data-testid="card-popover"
      style={{ top: position.top, left: position.left, width: 340, zIndex: 9999 }}
      className="fixed bg-base-200 border border-base-300 rounded-xl shadow-2xl flex flex-col gap-3 p-4 max-h-[80vh] overflow-y-auto"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-base-content/70 truncate">{task.title}</span>
        <button
          aria-label="Close popover"
          className="btn btn-xs btn-ghost h-5 min-h-0 px-1 shrink-0"
          onClick={onClose}
        >✕</button>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Title</label>
        <input
          className="input input-xs input-bordered w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Description</label>
        <textarea
          className="textarea textarea-xs textarea-bordered w-full resize-none"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description…"
        />
      </div>

      <div className="border-t border-base-300" />

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Priority</label>
          <select
            className="select select-xs select-bordered w-full"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
          >
            <option value={1}>{PRIORITY_LABEL[1]}</option>
            <option value={2}>{PRIORITY_LABEL[2]}</option>
            <option value={3}>{PRIORITY_LABEL[3]}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Status</label>
          <select
            className="select select-xs select-bordered w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {(Object.entries(STATUS_LABEL) as [TaskStatus, string][]).map(([s, label]) => (
              <option key={s} value={s}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Category</label>
        <input
          list="popover-cat-list"
          className="input input-xs input-bordered w-full"
          placeholder="Category…"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="popover-cat-list">
          {KNOWN_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </datalist>
      </div>

      <div className="border-t border-base-300" />

      {/* Note */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Note</label>
        <textarea
          className="textarea textarea-xs textarea-bordered w-full resize-none"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
        />
      </div>

      {/* Epic */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Epic</label>
        <input
          className="input input-xs input-bordered w-full"
          value={epicName}
          onChange={(e) => setEpicName(e.target.value)}
          placeholder="Epic name…"
        />
      </div>

      {/* Sprint */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Sprint</label>
        <input
          className="input input-xs input-bordered w-full"
          value={sprintName}
          onChange={(e) => setSprintName(e.target.value)}
          placeholder="Sprint name…"
        />
      </div>

      {/* Target Date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Target Date</label>
        <input
          type="date"
          className="input input-xs input-bordered w-full"
          value={sectionTargetDate}
          onChange={(e) => setSectionTargetDate(e.target.value)}
        />
      </div>

      <div className="border-t border-base-300" />

      {/* Metadata */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-base-content/35">
          Created: {new Date(task.createdAt).toLocaleDateString()}
        </span>
        <span className="text-[10px] text-base-content/35">
          Updated: {new Date(task.updatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1">
        <button className="btn btn-xs btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-xs btn-primary"
          onClick={handleSave}
          disabled={!title.trim()}
        >Save</button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/renderer/src/widgets/kanban/KanbanCardPopover.test.tsx
```

Expected: all 7 tests PASS

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep KanbanCardPopover
```

Expected: no output (no errors)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/widgets/kanban/KanbanCardPopover.tsx \
        src/renderer/src/widgets/kanban/KanbanCardPopover.test.tsx
git commit -m "feat(kanban): add KanbanCardPopover portal component with all fields"
```

---

### Task 2: Wire hover logic into KanbanCard

**Files:**
- Modify: `src/renderer/src/widgets/kanban/KanbanCard.tsx`
- Create: `src/renderer/src/widgets/kanban/KanbanCard.test.tsx`

**Interfaces:**
- Consumes: `KanbanCardPopover` from `./KanbanCardPopover` (Task 1)
  ```typescript
  // KanbanCardPopover(props: { task, position: {top,left}, onSave, onClose, onMouseEnter, onMouseLeave })
  ```
- Produces: updated `KanbanCard` with hover behavior (no new exported interface)

- [ ] **Step 1: Write failing hover tests**

Create `src/renderer/src/widgets/kanban/KanbanCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KanbanCard } from './KanbanCard'
import type { TaskItem } from '@shared/types/task.types'

const mockTask: TaskItem = {
  id: 'task-1',
  repoId: 'repo-1',
  title: 'Fix login bug',
  description: '',
  priority: 2,
  status: 'backlog',
  category: null,
  agentId: null,
  position: 0,
  sbarId: null,
  sprintName: null,
  epicName: null,
  projectId: null,
  sectionTargetDate: null,
  note: null,
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-21T00:00:00Z',
}

describe('KanbanCard hover popover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, left: 50, right: 250, bottom: 150,
      width: 200, height: 50, x: 50, y: 100,
      toJSON: () => ({})
    } as DOMRect)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows popover after 650ms hover on card', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByText('Fix login bug').closest('[draggable]')!
    fireEvent.mouseEnter(card)
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(650) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
  })

  it('does not show popover if mouse leaves before 650ms', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByText('Fix login bug').closest('[draggable]')!
    fireEvent.mouseEnter(card)
    await act(async () => { vi.advanceTimersByTime(400) })
    fireEvent.mouseLeave(card)
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('closes popover 150ms after mouse leaves both card and popover', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByText('Fix login bug').closest('[draggable]')!
    fireEvent.mouseEnter(card)
    await act(async () => { vi.advanceTimersByTime(650) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
    fireEvent.mouseLeave(card)
    await act(async () => { vi.advanceTimersByTime(149) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('keeps popover open when mouse moves from card into popover', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByText('Fix login bug').closest('[draggable]')!
    fireEvent.mouseEnter(card)
    await act(async () => { vi.advanceTimersByTime(650) })
    const popover = screen.getByTestId('card-popover')
    fireEvent.mouseLeave(card)
    fireEvent.mouseEnter(popover)
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
  })

  it('does not open popover when card is in inline edit mode', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    // Enter inline edit mode by clicking the edit button
    fireEvent.click(screen.getByTitle('Edit task'))
    // The draggable card is no longer rendered in edit mode
    expect(screen.queryByTitle('Edit task')).not.toBeInTheDocument()
    // Timer advance — no popover should appear
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('closes popover when inline edit is activated while popover is open', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByText('Fix login bug').closest('[draggable]')!
    fireEvent.mouseEnter(card)
    await act(async () => { vi.advanceTimersByTime(650) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
    // Click edit button — popover should close
    fireEvent.click(screen.getByTitle('Edit task'))
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/renderer/src/widgets/kanban/KanbanCard.test.tsx
```

Expected: FAIL — `KanbanCardPopover` not rendered, hover logic doesn't exist yet

- [ ] **Step 3: Update KanbanCard.tsx**

Replace the entire file with the following (all existing behaviour preserved, new hover/popover wiring added).

`KanbanCardPopover` already calls `createPortal` internally — do NOT import or call `createPortal` in `KanbanCard`; just render `<KanbanCardPopover>` as a plain JSX child.

```tsx
import React, { useState, useRef, useEffect } from 'react'
import type { TaskItem, TaskPriority, UpdateTaskInput } from '@shared/types/task.types'
import { PRIORITY_LABEL, STATUS_LABEL, CATEGORY_LABEL, KNOWN_CATEGORIES } from '@shared/types/task.types'
import { KanbanCardPopover } from './KanbanCardPopover'

interface KanbanCardProps {
  task: TaskItem
  agentColor?: string
  agentName?: string
  repoGlowColor?: string
  onSBARClick?: () => void
  onPriorityChange?: (priority: TaskPriority) => void
  onDelete?: () => void
  onEdit?: (input: UpdateTaskInput) => void
}

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  1: 'bg-error/15 text-error border-error/30',
  2: 'bg-warning/15 text-warning border-warning/30',
  3: 'bg-base-content/8 text-base-content/50 border-base-content/15'
}

const CATEGORY_CLASS: Record<string, string> = {
  backend:       'bg-violet-500/15 text-violet-400 border-violet-500/25',
  frontend:      'bg-sky-500/15 text-sky-400 border-sky-500/25',
  database:      'bg-amber-500/15 text-amber-400 border-amber-500/25',
  schema:        'bg-teal-500/15 text-teal-400 border-teal-500/25',
  functionality: 'bg-green-500/15 text-green-400 border-green-500/25'
}
const DEFAULT_CATEGORY_CLASS = 'bg-base-content/8 text-base-content/50 border-base-content/15'

function cyclePriority(p: TaskPriority): TaskPriority {
  return p === 1 ? 2 : p === 2 ? 3 : 1
}

function computePopoverPosition(rect: DOMRect): { top: number; left: number } {
  const popoverWidth = 340
  const gap = 12
  const rightSpace = window.innerWidth - rect.right
  const leftSpace = rect.left
  let left: number
  if (rightSpace >= popoverWidth + gap) {
    left = rect.right + gap
  } else if (leftSpace >= popoverWidth + gap) {
    left = rect.left - popoverWidth - gap
  } else {
    left = Math.max(0, (window.innerWidth - popoverWidth) / 2)
  }
  const estimatedMaxHeight = Math.min(window.innerHeight * 0.8, 600)
  const top = Math.min(rect.top, window.innerHeight - estimatedMaxHeight - 12)
  return { top, left }
}

export function KanbanCard({ task, agentColor, agentName, repoGlowColor, onSBARClick, onPriorityChange, onDelete, onEdit }: KanbanCardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editNote, setEditNote] = useState('')
  const [popoverVisible, setPopoverVisible] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const cardRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close popover and cancel open timer when inline edit activates
  useEffect(() => {
    if (editing) {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
      setPopoverVisible(false)
    }
  }, [editing])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  function scheduleClose() {
    closeTimerRef.current = setTimeout(() => {
      setPopoverVisible(false)
    }, 150)
  }

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function handleCardMouseEnter() {
    if (editing || popoverVisible) return
    openTimerRef.current = setTimeout(() => {
      if (!cardRef.current) return
      const rect = cardRef.current.getBoundingClientRect()
      setPopoverPos(computePopoverPosition(rect))
      setPopoverVisible(true)
    }, 650)
  }

  function handleCardMouseLeave() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    scheduleClose()
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function startEdit() {
    setEditTitle(task.title)
    setEditCategory(task.category ?? '')
    setEditNote(task.note ?? '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  function submitEdit() {
    if (!editTitle.trim()) return
    onEdit?.({ title: editTitle.trim(), category: editCategory.trim() || null, note: editNote.trim() || null })
    setEditing(false)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDelete) {
      onDelete?.()
    } else {
      setConfirmDelete(true)
    }
  }

  const priorityLabel = PRIORITY_LABEL[task.priority]
  const priorityClass = PRIORITY_CLASS[task.priority]

  if (editing) {
    return (
      <div className="rounded-lg bg-base-100 border border-primary/50 shadow-sm px-3 py-2.5 flex flex-col gap-2">
        <input
          autoFocus
          className="input input-xs input-bordered w-full"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') cancelEdit() }}
          placeholder="Title"
        />
        <input
          list={`edit-cat-${task.id}`}
          className="input input-xs input-bordered w-full"
          placeholder="Category…"
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
        />
        <datalist id={`edit-cat-${task.id}`}>
          {KNOWN_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </datalist>
        <textarea
          className="textarea textarea-xs textarea-bordered w-full resize-none"
          rows={2}
          placeholder="Note…"
          value={editNote}
          onChange={(e) => setEditNote(e.target.value)}
        />
        <div className="flex gap-1 justify-end">
          <button className="btn btn-xs btn-ghost" onClick={cancelEdit}>Cancel</button>
          <button className="btn btn-xs btn-primary" onClick={submitEdit}>Save</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onMouseEnter={handleCardMouseEnter}
        onMouseLeave={() => { handleCardMouseLeave(); setConfirmDelete(false) }}
        className="relative group rounded-lg bg-base-100 border border-base-300 shadow-sm cursor-grab active:cursor-grabbing px-3 py-2.5 flex flex-col gap-2 hover:border-base-content/20 transition-colors"
        style={repoGlowColor ? { borderLeftColor: repoGlowColor, borderLeftWidth: 3 } : undefined}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</span>
          <span
            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityClass} ${onPriorityChange ? 'cursor-pointer hover:opacity-70' : ''}`}
            title={onPriorityChange ? 'Click to cycle priority' : undefined}
            onClick={onPriorityChange ? (e) => { e.stopPropagation(); onPriorityChange(cyclePriority(task.priority)) } : undefined}
          >
            {priorityLabel}
          </span>
        </div>

        {/* Category + sprint */}
        {(task.category || task.sprintName) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.category && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_CLASS[task.category] ?? DEFAULT_CATEGORY_CLASS}`}>
                {CATEGORY_LABEL[task.category] ?? task.category}
              </span>
            )}
            {task.sprintName && (
              <span className="text-[10px] text-base-content/40 truncate max-w-[90px]">{task.sprintName}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5">
          {repoGlowColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0 border border-base-300"
              style={{ backgroundColor: repoGlowColor }}
              title="Repo"
            />
          )}
          {agentColor && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agentColor }} title={agentName} />
          )}
          {task.note && (
            <span className="text-[10px] text-base-content/40">✎</span>
          )}
          <span className="text-[10px] text-base-content/35 ml-auto">{STATUS_LABEL[task.status]}</span>
          {onEdit && (
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 text-base-content/40 hover:text-base-content"
              title="Edit task"
              onMouseEnter={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); startEdit() }}
            >✏</button>
          )}
          {onDelete && (
            <button
              className={`opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost h-5 min-h-0 px-1 ${confirmDelete ? 'text-error' : 'text-base-content/40 hover:text-error'}`}
              title={confirmDelete ? 'Click again to confirm' : 'Delete task'}
              onMouseEnter={(e) => e.stopPropagation()}
              onClick={handleDeleteClick}
            >{confirmDelete ? '✓' : '✕'}</button>
          )}
          {task.sbarId && onSBARClick && (
            <button
              className="btn btn-xs btn-ghost py-0 h-5 min-h-0 text-[10px]"
              onClick={onSBARClick}
              title="View SBAR summary"
            >SBAR</button>
          )}
        </div>
      </div>

      {popoverVisible && onEdit && (
        <KanbanCardPopover
          task={task}
          position={popoverPos}
          onSave={(input) => onEdit(input)}
          onClose={() => setPopoverVisible(false)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run hover tests**

```bash
npx vitest run src/renderer/src/widgets/kanban/KanbanCard.test.tsx
```

Expected: all 6 tests PASS

- [ ] **Step 5: Run full kanban test suite**

```bash
npx vitest run src/renderer/src/widgets/kanban/
```

Expected: all tests PASS

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "kanban|KanbanCard"
```

Expected: no output (no errors)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/widgets/kanban/KanbanCard.tsx \
        src/renderer/src/widgets/kanban/KanbanCard.test.tsx
git commit -m "feat(kanban): wire hover popover into KanbanCard with 650ms delay and conflict suppression"
```
