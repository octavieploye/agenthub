# Sprint Intake Design — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **This plan AMENDS `.claude/refactor/kanban/kanban-automation/plan.md`.**
> Tasks 1 and 6 are unchanged — execute the original plan exactly for those.
> Tasks 2, 3, 4, 5, and 7 replace the corresponding tasks in the original plan.
> Spec: `docs/superpowers/specs/2026-06-24-sprint-intake-design.md`

**Goal:** Two-file sprint output (sprint.md to project folder + .draft.json to intake dir), user-triggered import via "Sprint ↑" button, draft persistence across sessions, and a draft-ready indicator in the Kanban header.

**Architecture:** The decomposition agent writes two files: a human-readable `sprint.md` to `{project.path}/sprint.md` and a structured `sprint-{project.id}.draft.json` to `{userData}/sprint-intake/`. `SprintWatcher` ignores `.draft.json` files but emits a `DRAFT_READY` event when it detects one (startup scan or during session). When the user clicks "Sprint ↑" and a draft is ready, AgentHub renames `.draft.json` → `.json`, which triggers `SprintWatcher` to stage the sprint and show `SprintPreviewModal`. The user then confirms the import.

**Tech Stack:** Electron + React + Zustand + better-sqlite3 + Tailwind/DaisyUI. Tests use vitest. File watching via Node built-in `fs.watch` + `fs.renameSync`.

## Global Constraints

- Never mock modules with `vi.mock()` — tests must exercise real code paths. Only mock Electron `BrowserWindow`.
- Never change dependency versions without user approval.
- Never edit `.gitignore`.
- Run `npx tsc --noEmit` after every task to verify type safety.
- Max nesting: level 1 in new functions.
- 1 function = 1 responsibility.
- Only `git-ops` agent is allowed to run `git commit`.
- Do not add new npm dependencies — use Node built-ins (`fs.watch`, `fs.renameSync`, `path`, `crypto`).

---

## Changes Summary

| Task | Action |
|------|--------|
| Task 1: DB migration (task_dependencies) | **Execute original plan Task 1 — fix only: use migration number `022`, not `019`** |
| Task 2: IPC channels | **Replace with amended version below** |
| Task 3: SprintWatcher + kanban.ipc.ts | **Replace with amended version below** |
| Task 4: Prompt helper | **Replace with amended version below** |
| Task 5: SprintIntakeModal | **Replace with amended version below** |
| Task 6: SprintPreviewModal | **Execute original plan Task 6 unchanged** |
| Task 7: KanbanBoard wiring | **Replace with amended version below** |

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/main/db/migrations/022-task-dependencies.sql` | Junction table for task blocking |
| Create | `src/main/db/queries/task-dependencies.queries.ts` | Insert dep, load dep map |
| Modify | `src/main/db/queries/tasks.queries.ts` | Embed `blockedBy` in `getAllTasks` |
| Modify | `src/shared/types/task.types.ts` | Add `blockedBy`, `localId`, `dependsOn`, `SprintIntakePayload`, `SprintPendingPayload`, `SprintDraftReadyPayload` |
| Modify | `src/shared/constants/ipc-channels.ts` | Add `SPRINT_CONFIRM`, `SPRINT_REJECT`, `SPRINT_CONFIRM_DRAFT` channels + `SPRINT_PENDING`, `DRAFT_READY` events |
| Modify | `src/shared/types/ipc.types.ts` | Add bridge method signatures |
| Modify | `src/preload/index.ts` | Expose new kanban methods + `sprintPending` + `draftReady` events |
| Create | `src/main/services/sprint-watcher.ts` | Watch intake dir, emit pending/draft-ready, handle confirm/reject/confirmDraft |
| Modify | `src/main/ipc/kanban.ipc.ts` | Add `SPRINT_CONFIRM`, `SPRINT_REJECT`, `SPRINT_CONFIRM_DRAFT` handlers |
| Modify | `src/main/services/service-orchestrator.ts` | Register `SprintWatcher`, pass to `registerKanbanHandlers` |
| Create | `src/renderer/src/helpers/sprint-decomposition-prompt.ts` | Build agent task string with two-file output instructions |
| Create | `src/renderer/src/widgets/kanban/SprintIntakeModal.tsx` | Form: project (with path check + folder picker) + repo + launch |
| Create | `src/renderer/src/widgets/kanban/SprintPreviewModal.tsx` | Preview pending sprint — confirm/reject (unchanged from original plan) |
| Modify | `src/renderer/src/widgets/kanban/KanbanCard.tsx` | `blockedByCount` prop + badge |
| Modify | `src/renderer/src/widgets/kanban/KanbanBoard.tsx` | Draft-ready indicator, split Sprint ↑ behavior (draft confirm vs spawn modal) |

---

## Task 1: DB Migration + task-dependencies queries + type updates

**Execute original plan Task 1 exactly, with one change:**

In Step 1, name the file `022-task-dependencies.sql`, not `019-task-dependencies.sql`. Migration 019 is already taken (`019-project-path.sql`). The latest migration is `021-fk-cascades.sql`.

All code in Task 1 is correct as written. Run it first — everything else depends on `blockedBy` being on `TaskItem`.

---

## Task 2: IPC channels + preload + bridge types

**Files:**
- Modify: `src/shared/constants/ipc-channels.ts`
- Modify: `src/shared/types/task.types.ts`
- Modify: `src/shared/types/ipc.types.ts`
- Modify: `src/preload/index.ts`

**Interfaces:**
- Consumes: existing `IPC_CHANNELS.KANBAN`, `IPC_EVENTS`
- Produces:
  - `IPC_CHANNELS.KANBAN.SPRINT_CONFIRM: 'kanban:sprint-confirm'`
  - `IPC_CHANNELS.KANBAN.SPRINT_REJECT: 'kanban:sprint-reject'`
  - `IPC_CHANNELS.KANBAN.SPRINT_CONFIRM_DRAFT: 'kanban:sprint-confirm-draft'`
  - `IPC_EVENTS.KANBAN.SPRINT_PENDING: 'on-kanban:sprint-pending'`
  - `IPC_EVENTS.KANBAN.DRAFT_READY: 'on-kanban:draft-ready'`
  - `window.agentHub.kanban.sprintConfirm(pendingId: string): Promise<IpcResponse<void>>`
  - `window.agentHub.kanban.sprintReject(pendingId: string): Promise<IpcResponse<void>>`
  - `window.agentHub.kanban.sprintConfirmDraft(projectId: string): Promise<IpcResponse<void>>`
  - `window.agentHub.on.sprintPending(cb: (payload: SprintPendingPayload) => void): () => void`
  - `window.agentHub.on.draftReady(cb: (payload: SprintDraftReadyPayload) => void): () => void`

- [ ] **Step 1: Add channels + events to ipc-channels.ts**

In `src/shared/constants/ipc-channels.ts`, expand the `KANBAN` block:

```typescript
  KANBAN: {
    OPEN: 'kanban:open',
    UPDATE_POSITION: 'kanban:update-position',
    SPRINT_INTAKE: 'kanban:sprint-intake',
    SPRINT_CONFIRM: 'kanban:sprint-confirm',
    SPRINT_REJECT: 'kanban:sprint-reject',
    SPRINT_CONFIRM_DRAFT: 'kanban:sprint-confirm-draft'
  },
```

Add a `KANBAN` key to `IPC_EVENTS`:

```typescript
export const IPC_EVENTS = {
  // ... existing keys ...
  KANBAN: {
    SPRINT_PENDING: 'on-kanban:sprint-pending',
    DRAFT_READY: 'on-kanban:draft-ready'
  },
  // ... rest unchanged ...
} as const
```

- [ ] **Step 2: Add new types to task.types.ts**

In `src/shared/types/task.types.ts`, add at the bottom:

```typescript
export interface SprintStoryInput {
  localId: string
  title: string
  description: string
  priority: TaskPriority
  dependsOn?: string[]
}

export interface SprintEpicInput {
  name: string
  targetDate?: string
  tasks: SprintStoryInput[]
}

export interface SprintIntakePayload {
  sprintName: string
  projectName?: string   // human-readable name — resolved to UUID by SprintWatcher.confirm()
  repoId: string
  epics: SprintEpicInput[]
}

export interface SprintPendingPayload {
  pendingId: string
  sprintName: string
  projectName?: string
  epicCount: number
  taskCount: number
  dependencyCount: number
  repoId: string
}

export interface SprintDraftReadyPayload {
  projectId: string      // the project.id used in the filename sprint-{project.id}.draft.json
  draftFilename: string  // e.g. 'sprint-abc123.draft.json'
}
```

Also add to `CreateTaskInput`:

```typescript
  localId?: string           // ephemeral: used only for dependency wiring in sprint batch insert, not stored
  dependsOn?: string[]       // local IDs — resolved to real UUIDs at insert time
  sectionTargetDate?: string | null
```

- [ ] **Step 3: Add bridge types to ipc.types.ts**

In `src/shared/types/ipc.types.ts`, update the `kanban` section of `AgentHubBridge`:

```typescript
  kanban: {
    open: (agentId?: string) => Promise<IpcResponse<void>>
    updatePosition: (taskId: string, position: number) => Promise<IpcResponse<void>>
    sprintIntake: (stories: unknown[]) => Promise<IpcResponse<unknown>>
    sprintConfirm: (pendingId: string) => Promise<IpcResponse<void>>
    sprintReject: (pendingId: string) => Promise<IpcResponse<void>>
    sprintConfirmDraft: (projectId: string) => Promise<IpcResponse<void>>
  }
```

Also in the `on` section of `AgentHubBridge`:

```typescript
    sprintPending: (
      cb: (payload: import('./task.types').SprintPendingPayload) => void
    ) => () => void
    draftReady: (
      cb: (payload: import('./task.types').SprintDraftReadyPayload) => void
    ) => () => void
```

- [ ] **Step 4: Add preload entries**

In `src/preload/index.ts`, inside the `kanban` object:

```typescript
    sprintConfirm: (pendingId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN.SPRINT_CONFIRM, pendingId),
    sprintReject: (pendingId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN.SPRINT_REJECT, pendingId),
    sprintConfirmDraft: (projectId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN.SPRINT_CONFIRM_DRAFT, projectId),
```

Inside the `on` object, after `tasksUpdated`:

```typescript
    sprintPending: (callback: (payload: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => callback(payload)
      ipcRenderer.on(IPC_EVENTS.KANBAN.SPRINT_PENDING, handler)
      return (): void => { ipcRenderer.removeListener(IPC_EVENTS.KANBAN.SPRINT_PENDING, handler) }
    },
    draftReady: (callback: (payload: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => callback(payload)
      ipcRenderer.on(IPC_EVENTS.KANBAN.DRAFT_READY, handler)
      return (): void => { ipcRenderer.removeListener(IPC_EVENTS.KANBAN.DRAFT_READY, handler) }
    },
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/constants/ipc-channels.ts \
        src/shared/types/ipc.types.ts \
        src/shared/types/task.types.ts \
        src/preload/index.ts
git commit -m "feat(kanban): add sprint-pending, draft-ready events and sprint confirm/reject/confirm-draft IPC channels"
```

---

## Task 3: SprintWatcher service + kanban.ipc.ts + service-orchestrator

**Files:**
- Create: `src/main/services/sprint-watcher.ts`
- Modify: `src/main/ipc/kanban.ipc.ts`
- Modify: `src/main/services/service-orchestrator.ts`
- Test: `src/main/services/sprint-watcher.test.ts`

**Interfaces:**
- Consumes: `insertTask`, `insertTaskDependency`, `IPC_EVENTS.KANBAN`, `SprintIntakePayload`, `SprintPendingPayload`, `SprintDraftReadyPayload`
- Produces:
  - `SprintWatcher` class with:
    - `start(intakeDir, emitFn)` — watches for `.json` (not `.draft.json`) files + `.draft.json` for DRAFT_READY
    - `startupScan(intakeDir, emitFn)` — scans for existing `.draft.json` files on app start
    - `parseAndStage(filename, intakeDir, emitFn)` — validates and stages a sprint JSON
    - `confirm(db, pendingId, emitFn)` — two-pass insert + dependencies
    - `reject(pendingId)` — deletes the staged file
    - `confirmDraft(projectId, intakeDir, emitFn)` — renames `.draft.json` → `.json` to trigger import

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/services/sprint-watcher.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/connection'
import { SprintWatcher } from './sprint-watcher'
import type { SprintPendingPayload, SprintDraftReadyPayload, SprintIntakePayload } from '../../shared/types/task.types'

let intakeDir: string
let db: Database.Database
let emitted: { channel: string; payload: unknown }[]
let watcher: SprintWatcher

function mockEmit(channel: string, payload: unknown): void {
  emitted.push({ channel, payload })
}

beforeEach(() => {
  intakeDir = join(tmpdir(), `sprint-watcher-test-${Date.now()}`)
  mkdirSync(intakeDir, { recursive: true })
  db = new Database(':memory:')
  runMigrations(db)
  db.prepare("INSERT INTO repos (id, name, path, created_at) VALUES ('r1', 'repo', '/tmp', datetime('now'))").run()
  emitted = []
  watcher = new SprintWatcher()
})

afterEach(() => {
  watcher.stop()
  db.close()
  rmSync(intakeDir, { recursive: true, force: true })
})

describe('SprintWatcher.startupScan', () => {
  it('emits DRAFT_READY for each .draft.json file found', () => {
    writeFileSync(join(intakeDir, 'sprint-proj-abc.draft.json'), '{}', 'utf-8')
    writeFileSync(join(intakeDir, 'sprint-proj-xyz.draft.json'), '{}', 'utf-8')
    writeFileSync(join(intakeDir, 'sprint-ignore.json'), '{}', 'utf-8') // not a draft, should not emit

    watcher.startupScan(intakeDir, mockEmit)

    const draftEmits = emitted.filter((e) => e.channel === 'on-kanban:draft-ready')
    expect(draftEmits).toHaveLength(2)
    const projectIds = draftEmits.map((e) => (e.payload as SprintDraftReadyPayload).projectId)
    expect(projectIds).toContain('proj-abc')
    expect(projectIds).toContain('proj-xyz')
  })

  it('emits nothing when intake dir has no draft files', () => {
    watcher.startupScan(intakeDir, mockEmit)
    expect(emitted).toHaveLength(0)
  })
})

describe('SprintWatcher.parseAndStage', () => {
  it('stages a valid sprint JSON and emits SPRINT_PENDING', () => {
    const payload: SprintIntakePayload = {
      sprintName: 'Sprint 1',
      repoId: 'r1',
      epics: [
        {
          name: 'Auth',
          tasks: [
            { localId: 't1', title: 'JWT helpers', description: 'write helpers', priority: 1 },
            { localId: 't2', title: 'Protect routes', description: 'middleware', priority: 2, dependsOn: ['t1'] }
          ]
        }
      ]
    }
    const filename = 'sprint-proj-abc.json'
    writeFileSync(join(intakeDir, filename), JSON.stringify(payload), 'utf-8')

    watcher.parseAndStage(filename, intakeDir, mockEmit)

    expect(emitted).toHaveLength(1)
    expect(emitted[0].channel).toBe('on-kanban:sprint-pending')
    const p = emitted[0].payload as SprintPendingPayload
    expect(p.sprintName).toBe('Sprint 1')
    expect(p.taskCount).toBe(2)
    expect(p.dependencyCount).toBe(1)
    expect(p.epicCount).toBe(1)
  })

  it('ignores .draft.json files in parseAndStage', () => {
    writeFileSync(join(intakeDir, 'sprint-proj.draft.json'), '{}', 'utf-8')
    // parseAndStage should not be called by the watcher for .draft.json files
    // but if called directly it just returns null silently — test the real guard
    const result = watcher.parseAndStage('sprint-proj.draft.json', intakeDir, mockEmit)
    expect(result).toBeNull()
    expect(emitted).toHaveLength(0)
  })
})

describe('SprintWatcher.confirmDraft', () => {
  it('renames .draft.json to .json and the renamed file exists', () => {
    const projectId = 'proj-abc'
    const draftPath = join(intakeDir, `sprint-${projectId}.draft.json`)
    const finalPath = join(intakeDir, `sprint-${projectId}.json`)
    writeFileSync(draftPath, JSON.stringify({ sprintName: 'S1', repoId: 'r1', epics: [] }), 'utf-8')

    watcher.confirmDraft(projectId, intakeDir)

    expect(existsSync(draftPath)).toBe(false)
    expect(existsSync(finalPath)).toBe(true)
  })
})

describe('SprintWatcher.confirm', () => {
  it('inserts tasks and dependencies, deletes the file', () => {
    const payload: SprintIntakePayload = {
      sprintName: 'Sprint 1',
      repoId: 'r1',
      epics: [
        {
          name: 'Auth',
          tasks: [
            { localId: 't1', title: 'JWT helpers', description: 'write helpers', priority: 1 },
            { localId: 't2', title: 'Protect routes', description: 'middleware', priority: 2, dependsOn: ['t1'] }
          ]
        }
      ]
    }
    const filePath = join(intakeDir, 'sprint-proj-abc.json')
    writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
    watcher.parseAndStage('sprint-proj-abc.json', intakeDir, mockEmit)

    const pendingId = (emitted[0].payload as SprintPendingPayload).pendingId
    watcher.confirm(db, pendingId, mockEmit)

    const tasks = db.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[]
    expect(tasks).toHaveLength(2)
    const deps = db.prepare('SELECT * FROM task_dependencies').all()
    expect(deps).toHaveLength(1)
    expect(existsSync(filePath)).toBe(false)
  })
})

describe('SprintWatcher.reject', () => {
  it('deletes the file without inserting tasks', () => {
    const payload: SprintIntakePayload = {
      sprintName: 'Sprint 1',
      repoId: 'r1',
      epics: [{ name: 'Auth', tasks: [{ localId: 't1', title: 'T', description: '', priority: 3 }] }]
    }
    const filePath = join(intakeDir, 'sprint-rej.json')
    writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
    watcher.parseAndStage('sprint-rej.json', intakeDir, mockEmit)

    const pendingId = (emitted[0].payload as SprintPendingPayload).pendingId
    watcher.reject(pendingId)

    expect(db.prepare('SELECT * FROM tasks').all()).toHaveLength(0)
    expect(existsSync(filePath)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub
npx vitest run src/main/services/sprint-watcher.test.ts
```

Expected: FAIL — `sprint-watcher` module not found.

- [ ] **Step 3: Create SprintWatcher**

```typescript
// src/main/services/sprint-watcher.ts
import { watch, existsSync, mkdirSync, readFileSync, unlinkSync, readdirSync, renameSync } from 'fs'
import type { FSWatcher } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskDependency } from '../db/queries/task-dependencies.queries'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type { SprintIntakePayload, SprintPendingPayload, SprintDraftReadyPayload } from '../../shared/types/task.types'

type EmitFn = (channel: string, payload: unknown) => void

interface PendingEntry {
  pendingId: string
  filePath: string
  payload: SprintIntakePayload
}

export class SprintWatcher {
  private watcher: FSWatcher | null = null
  private pending = new Map<string, PendingEntry>()

  start(intakeDir: string, emitFn: EmitFn): void {
    if (!existsSync(intakeDir)) mkdirSync(intakeDir, { recursive: true })
    this.startupScan(intakeDir, emitFn)
    this.watcher = watch(intakeDir, (_eventType, filename) => {
      if (!filename) return
      if (filename.match(/^sprint-.+\.draft\.json$/)) {
        const projectId = filename.replace(/^sprint-/, '').replace(/\.draft\.json$/, '')
        const payload: SprintDraftReadyPayload = { projectId, draftFilename: filename }
        emitFn(IPC_EVENTS.KANBAN.DRAFT_READY, payload)
        return
      }
      if (filename.match(/^sprint-.+\.json$/) && !filename.endsWith('.draft.json')) {
        const filePath = join(intakeDir, filename)
        if (!existsSync(filePath)) return
        this.parseAndStage(filename, intakeDir, emitFn)
      }
    })
    log.info('SprintWatcher started', { intakeDir })
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }

  startupScan(intakeDir: string, emitFn: EmitFn): void {
    if (!existsSync(intakeDir)) return
    const files = readdirSync(intakeDir)
    for (const filename of files) {
      if (!filename.match(/^sprint-.+\.draft\.json$/)) continue
      const projectId = filename.replace(/^sprint-/, '').replace(/\.draft\.json$/, '')
      const payload: SprintDraftReadyPayload = { projectId, draftFilename: filename }
      emitFn(IPC_EVENTS.KANBAN.DRAFT_READY, payload)
      log.info('SprintWatcher: draft found on startup', { filename, projectId })
    }
  }

  confirmDraft(projectId: string, intakeDir: string): void {
    const draftPath = join(intakeDir, `sprint-${projectId}.draft.json`)
    const finalPath = join(intakeDir, `sprint-${projectId}.json`)
    renameSync(draftPath, finalPath)
    log.info('SprintWatcher.confirmDraft: renamed draft to json', { projectId })
    // fs.watch will detect the new .json file and call parseAndStage automatically
  }

  parseAndStage(filename: string, intakeDir: string, emitFn: EmitFn): PendingEntry | null {
    if (filename.endsWith('.draft.json')) return null
    const filePath = join(intakeDir, filename)
    let payload: SprintIntakePayload
    try {
      payload = JSON.parse(readFileSync(filePath, 'utf-8')) as SprintIntakePayload
    } catch (err) {
      log.warn('SprintWatcher: failed to parse sprint JSON', { filePath, err })
      return null
    }
    if (!payload.sprintName || !payload.repoId || !Array.isArray(payload.epics)) {
      log.warn('SprintWatcher: invalid sprint JSON structure', { filePath })
      return null
    }
    const errors = validateSprintPayload(payload)
    if (errors.length > 0) {
      log.warn('SprintWatcher: sprint payload failed validation', { filePath, errors })
      return null
    }
    const pendingId = randomUUID()
    const entry: PendingEntry = { pendingId, filePath, payload }
    this.pending.set(pendingId, entry)

    const taskCount = payload.epics.reduce((n, e) => n + e.tasks.length, 0)
    const dependencyCount = payload.epics.reduce(
      (n, e) => n + e.tasks.reduce((m, t) => m + (t.dependsOn?.length ?? 0), 0),
      0
    )
    const summary: SprintPendingPayload = {
      pendingId,
      sprintName: payload.sprintName,
      projectName: payload.projectName,
      epicCount: payload.epics.length,
      taskCount,
      dependencyCount,
      repoId: payload.repoId
    }
    emitFn(IPC_EVENTS.KANBAN.SPRINT_PENDING, summary)
    log.info('SprintWatcher: sprint staged', { pendingId, sprintName: payload.sprintName, taskCount })
    return entry
  }

  confirm(db: Database.Database, pendingId: string, emitFn: EmitFn): void {
    const entry = this.pending.get(pendingId)
    if (!entry) {
      log.warn('SprintWatcher.confirm: unknown pendingId', { pendingId })
      return
    }
    const { filePath, payload } = entry

    const repo = db.prepare('SELECT id FROM repos WHERE id = ?').get(payload.repoId)
    if (!repo) {
      throw new Error(
        `Sprint import failed: repoId "${payload.repoId}" does not exist. Re-run the decomposition agent with a valid repo selected.`
      )
    }

    const existing = db
      .prepare('SELECT COUNT(*) as c FROM tasks WHERE sprint_name = ? AND repo_id = ?')
      .get(payload.sprintName, payload.repoId) as { c: number }
    if (existing.c > 0) {
      throw new Error(
        `Sprint "${payload.sprintName}" already has tasks in this repo. Discard this import or rename the sprint before re-importing.`
      )
    }

    const localIdToRealId = new Map<string, string>()
    for (const epic of payload.epics) {
      for (const story of epic.tasks) {
        const task = insertTask(db, {
          repoId: payload.repoId,
          title: story.title,
          description: story.description,
          priority: story.priority,
          status: 'backlog',
          sprintName: payload.sprintName,
          epicName: epic.name,
          sectionTargetDate: epic.targetDate ?? null
        })
        if (story.localId) localIdToRealId.set(story.localId, task.id)
      }
    }

    for (const epic of payload.epics) {
      for (const story of epic.tasks) {
        if (!story.dependsOn?.length || !story.localId) continue
        const taskId = localIdToRealId.get(story.localId)
        if (!taskId) continue
        for (const depLocalId of story.dependsOn) {
          const dependsOnId = localIdToRealId.get(depLocalId)
          if (dependsOnId) insertTaskDependency(db, taskId, dependsOnId)
        }
      }
    }

    try { unlinkSync(filePath) } catch { /* file already gone */ }
    this.pending.delete(pendingId)
    emitFn(IPC_EVENTS.TASKS.UPDATED, null)
    log.info('SprintWatcher.confirm: sprint inserted', { pendingId, sprintName: payload.sprintName })
  }

  reject(pendingId: string): void {
    const entry = this.pending.get(pendingId)
    if (!entry) return
    try { unlinkSync(entry.filePath) } catch { /* already gone */ }
    this.pending.delete(pendingId)
    log.info('SprintWatcher.reject: sprint rejected', { pendingId })
  }
}

function validateSprintPayload(payload: SprintIntakePayload): string[] {
  const errors: string[] = []
  const localIds = new Set<string>()
  for (const epic of payload.epics) {
    for (const task of epic.tasks) {
      if (![1, 2, 3].includes(task.priority)) {
        errors.push(`Task "${task.title}" has invalid priority ${task.priority} (must be 1, 2, or 3)`)
      }
      if (localIds.has(task.localId)) {
        errors.push(`Duplicate localId "${task.localId}"`)
      }
      localIds.add(task.localId)
    }
  }
  for (const epic of payload.epics) {
    for (const task of epic.tasks) {
      for (const dep of task.dependsOn ?? []) {
        if (!localIds.has(dep)) {
          errors.push(`Task "${task.title}" dependsOn unknown localId "${dep}"`)
        }
      }
    }
  }
  return errors
}
```

- [ ] **Step 4: Update kanban.ipc.ts — add SPRINT_CONFIRM, SPRINT_REJECT, SPRINT_CONFIRM_DRAFT handlers**

> **Do NOT replace the existing file.** The current `SPRINT_INTAKE` handler is working and must be preserved. Only ADD the new handlers.

Open `src/main/ipc/kanban.ipc.ts` and apply these changes:

**4a — Add the import:**

```typescript
import type { SprintWatcher } from '../services/sprint-watcher'
```

**4b — Update the function signature:**

```typescript
export function registerKanbanHandlers(
  db: Database.Database,
  windowManager: WindowManager,
  sprintWatcher: SprintWatcher,
  intakeDir: string
): void {
```

**4c — Add a local `emitToAllRenderers` helper** (before the function):

```typescript
function emitToAllRenderers(channel: string, ...args: unknown[]): void {
  const { BrowserWindow } = require('electron') as typeof import('electron')
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}
```

**4d — Add the three new handlers** inside `registerKanbanHandlers`, after the existing `SPRINT_INTAKE` handler:

```typescript
  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_CONFIRM, (_event, pendingId: string) => {
    try {
      sprintWatcher.confirm(db, pendingId, emitToAllRenderers)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_REJECT, (_event, pendingId: string) => {
    try {
      sprintWatcher.reject(pendingId)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.KANBAN.SPRINT_CONFIRM_DRAFT, (_event, projectId: string) => {
    try {
      sprintWatcher.confirmDraft(projectId, intakeDir)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })
```

- [ ] **Step 5: Register SprintWatcher in service-orchestrator.ts**

Add at the top with other imports:
```typescript
import { SprintWatcher } from './sprint-watcher'
import { join } from 'path'
```

Add with other module-level let declarations:
```typescript
let sprintWatcher: SprintWatcher | null = null
let intakeDir = ''
```

Inside `initializeServices(db)`, after all other service registrations, add:
```typescript
  intakeDir = join(app.getPath('userData'), 'sprint-intake')
  sprintWatcher = new SprintWatcher()
  sprintWatcher.start(intakeDir, emitToAllRenderers)
```

Update the `registerKanbanHandlers` call to include the new arguments:
```typescript
  registerKanbanHandlers(db, windowManager, sprintWatcher, intakeDir)
```

In the teardown function (wherever `app.on('before-quit')` or `cleanup()` is called), add:
```typescript
  sprintWatcher?.stop()
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/main/services/sprint-watcher.test.ts
```

Expected: PASS all tests (startupScan × 2, parseAndStage × 2, confirmDraft × 1, confirm × 1, reject × 1).

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/main/services/sprint-watcher.ts \
        src/main/services/sprint-watcher.test.ts \
        src/main/ipc/kanban.ipc.ts \
        src/main/services/service-orchestrator.ts
git commit -m "feat(kanban): add SprintWatcher with draft-aware file watching, startup scan, and confirm-draft rename flow"
```

---

## Task 4: Sprint decomposition prompt helper (two-file output)

**Files:**
- Create: `src/renderer/src/helpers/sprint-decomposition-prompt.ts`
- Test: `src/renderer/src/helpers/sprint-decomposition-prompt.test.ts`

**Interfaces:**
- Consumes: nothing from the codebase (pure function)
- Produces: `buildSprintDecompositionPrompt(input: SprintPromptInput): string`

```typescript
interface SprintPromptInput {
  docPath: string        // absolute path to the sprint/brief/todo doc the user wants decomposed
  projectName: string    // human-readable project name (e.g. "AgentHub TTS")
  repoId: string         // UUID of the repo — embedded in the JSON output
  outputPath: string     // absolute path to {userData}/sprint-intake/ — where .draft.json is written
  projectPath: string    // absolute path to the project folder — where sprint.md is written
  draftFilename: string  // e.g. 'sprint-abc123.draft.json' (computed by AgentHub from project.id)
}
```

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/src/helpers/sprint-decomposition-prompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildSprintDecompositionPrompt } from './sprint-decomposition-prompt'

const baseInput = {
  docPath: '/home/user/brief.md',
  projectName: 'My Project',
  repoId: 'repo-123',
  outputPath: '/home/user/.config/agenthub/sprint-intake',
  projectPath: '/home/user/projects/my-project',
  draftFilename: 'sprint-proj-abc.draft.json'
}

describe('buildSprintDecompositionPrompt', () => {
  it('includes the doc path', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('/home/user/brief.md')
  })

  it('includes the repoId in the JSON schema', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('repo-123')
  })

  it('includes the outputPath for the draft JSON', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('/home/user/.config/agenthub/sprint-intake')
  })

  it('includes the draftFilename', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('sprint-proj-abc.draft.json')
  })

  it('includes the projectPath for sprint.md', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('/home/user/projects/my-project')
  })

  it('instructs agent to write sprint.md first, draft JSON second', () => {
    const result = buildSprintDecompositionPrompt(baseInput)
    const mdIndex = result.indexOf('sprint.md')
    const draftIndex = result.indexOf('.draft.json')
    expect(mdIndex).toBeGreaterThan(-1)
    expect(draftIndex).toBeGreaterThan(-1)
    expect(mdIndex).toBeLessThan(draftIndex)
  })

  it('returns a non-empty string', () => {
    expect(buildSprintDecompositionPrompt(baseInput).length).toBeGreaterThan(200)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/renderer/src/helpers/sprint-decomposition-prompt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the prompt helper**

```typescript
// src/renderer/src/helpers/sprint-decomposition-prompt.ts

export interface SprintPromptInput {
  docPath: string
  projectName: string
  repoId: string
  outputPath: string
  projectPath: string
  draftFilename: string
}

export function buildSprintDecompositionPrompt(input: SprintPromptInput): string {
  const { docPath, projectName, repoId, outputPath, projectPath, draftFilename } = input
  return `You are a sprint decomposition agent for the project "${projectName}".

## Your task

1. Read the document at: ${docPath}
2. Write a human-readable summary to: ${projectPath}/sprint.md
   Plain markdown. No special format. Team members should be able to read and understand it.
3. Write the structured JSON to: ${outputPath}/${draftFilename}
   This file is read by AgentHub to create Kanban tasks.

**Write sprint.md FIRST. Write ${draftFilename} SECOND and LAST.**

## Rules for decomposition

- Group tasks under epics (themes or feature areas).
- Assign priority: 1 (High), 2 (Medium), 3 (Low) based on complexity and risk.
- If one task must be completed before another can start, set dependsOn with the earlier task's localId.
- Adapt the number of tasks to the actual complexity — do not pad with trivial tasks.
- Each task must be implementable independently (after its dependencies are done).
- Keep task titles short (< 80 chars). Put details in description.

## JSON schema for ${draftFilename}

Write ONLY valid JSON matching this exact structure. No markdown fences, no extra keys.

{
  "sprintName": "Sprint N — <short descriptor>",
  "repoId": "${repoId}",
  "projectName": "${projectName}",
  "epics": [
    {
      "name": "<epic name>",
      "targetDate": "<YYYY-MM-DD or omit>",
      "tasks": [
        {
          "localId": "t1",
          "title": "<short imperative title>",
          "description": "<1-2 sentences explaining the implementation>",
          "priority": 1,
          "dependsOn": []
        },
        {
          "localId": "t2",
          "title": "<short imperative title>",
          "description": "<1-2 sentences>",
          "priority": 2,
          "dependsOn": ["t1"]
        }
      ]
    }
  ]
}

## localId rules

- localId values must be unique strings within this JSON (e.g. "t1", "t2", "auth-1").
- dependsOn references must match existing localId values in the same JSON.
- localId is only used for wiring dependencies — it is NOT stored in the database.

## After writing both files

Print exactly this and nothing else after:
SPRINT_FILES_WRITTEN: sprint.md and ${draftFilename}

Begin by reading ${docPath}.`
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/renderer/src/helpers/sprint-decomposition-prompt.test.ts
```

Expected: PASS all 7 tests.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/helpers/sprint-decomposition-prompt.ts \
        src/renderer/src/helpers/sprint-decomposition-prompt.test.ts
git commit -m "feat(kanban): add sprint decomposition prompt builder with two-file output (sprint.md + .draft.json)"
```

---

## Task 5: SprintIntakeModal (with project.path check + folder picker)

**Files:**
- Create: `src/renderer/src/widgets/kanban/SprintIntakeModal.tsx`

**Interfaces:**
- Consumes:
  - `window.agentHub.agents.spawn(options)` — spawn the decomposition agent
  - `window.agentHub.db.getRepos()` — list repos
  - `window.agentHub.projects.list()` — list projects
  - `window.agentHub.projects.update(id, { path })` — set project.path inline
  - `window.agentHub.dialog.openDirectory()` — folder picker (uses `DIALOG.OPEN_DIRECTORY` which is already wired)
  - `buildSprintDecompositionPrompt(input: SprintPromptInput)` — builds the agent prompt
- Produces:
  - `SprintIntakeModal` component
  - Props: `isOpen: boolean, onClose: () => void, intakeDir: string`

> **Important about `dialog.openDirectory`:** The channel `DIALOG.OPEN_DIRECTORY` already exists in `IPC_CHANNELS`. Verify it is exposed in the preload as `window.agentHub.dialog.openDirectory()` before implementing Step 2. If it is not exposed, add it to the preload and bridge types first.

> **draftFilename derivation:** `draftFilename = 'sprint-${selectedProject.id}.draft.json'`. The filename uses `project.id` (the project's existing UUID from the DB) — NOT a freshly generated UUID. This guarantees exactly one draft per project.

- [ ] **Step 1: Verify `window.agentHub.dialog.openDirectory` is exposed**

Search for `openDirectory` in the preload:

```bash
grep -n 'openDirectory\|OPEN_DIRECTORY' src/preload/index.ts
```

If the output shows an entry in the `dialog` object, proceed to Step 2.
If not, add to `src/preload/index.ts` inside the `dialog` object:

```typescript
    openDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG.OPEN_DIRECTORY),
```

And add to `src/shared/types/ipc.types.ts` in the `dialog` bridge section:

```typescript
    openDirectory: () => Promise<IpcResponse<string | null>>
```

Then verify `src/main/ipc/` has a handler for `DIALOG.OPEN_DIRECTORY` that calls `dialog.showOpenDialog({ properties: ['openDirectory'] })`. If not, add it in the appropriate dialog/system IPC file:

```typescript
ipcMain.handle(IPC_CHANNELS.DIALOG.OPEN_DIRECTORY, async () => {
  const { dialog } = require('electron') as typeof import('electron')
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return { success: true, data: null }
  return { success: true, data: result.filePaths[0] }
})
```

- [ ] **Step 2: Create SprintIntakeModal.tsx**

```typescript
// src/renderer/src/widgets/kanban/SprintIntakeModal.tsx
import { useState, useEffect } from 'react'
import { buildSprintDecompositionPrompt } from '../../helpers/sprint-decomposition-prompt'
import type { RepoConfig } from '@shared/types/config.types'

interface Project {
  id: string
  name: string
  path: string | null
}

interface SprintIntakeModalProps {
  isOpen: boolean
  onClose: () => void
  intakeDir: string
}

export function SprintIntakeModal({ isOpen, onClose, intakeDir }: SprintIntakeModalProps) {
  const [docPath, setDocPath] = useState('')
  const [repos, setRepos] = useState<RepoConfig[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [pickingFolder, setPickingFolder] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    window.agentHub.db.getRepos().then((res) => {
      if (res.success) {
        setRepos(res.data)
        if (res.data.length > 0 && !selectedRepoId) setSelectedRepoId(res.data[0].id)
      }
    })
    window.agentHub.projects.list().then((res) => {
      if (res.success) setProjects(res.data)
    })
  }, [isOpen])

  function handleProjectChange(projectId: string): void {
    setSelectedProjectId(projectId)
    const project = projects.find((p) => p.id === projectId)
    setProjectPath(project?.path ?? null)
  }

  async function handlePickFolder(): Promise<void> {
    setPickingFolder(true)
    const res = await window.agentHub.dialog.openDirectory()
    setPickingFolder(false)
    if (!res.success || !res.data) return
    setProjectPath(res.data)
    if (selectedProjectId) {
      await window.agentHub.projects.update(selectedProjectId, { path: res.data })
    }
  }

  async function handleLaunch(): Promise<void> {
    const path = docPath.trim()
    if (!path || !selectedProjectId || !selectedRepoId) {
      setError('Document path, project, and repo are all required.')
      return
    }
    if (!projectPath) {
      setError('Set a project folder first — the agent needs a place to write sprint.md.')
      return
    }
    const repo = repos.find((r) => r.id === selectedRepoId)
    const project = projects.find((p) => p.id === selectedProjectId)
    if (!repo || !project) return

    setLaunching(true)
    setError(null)

    const draftFilename = `sprint-${selectedProjectId}.draft.json`
    const taskDescription = buildSprintDecompositionPrompt({
      docPath: path,
      projectName: project.name,
      repoId: selectedRepoId,
      outputPath: intakeDir,
      projectPath,
      draftFilename
    })

    const res = await window.agentHub.agents.spawn({
      repoId: selectedRepoId,
      cwd: projectPath,
      taskDescription
    })
    setLaunching(false)
    if (!res.success) {
      setError(res.error?.message ?? 'Spawn failed')
      return
    }
    onClose()
  }

  if (!isOpen) return null

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const needsPath = selectedProjectId && !projectPath

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel-glass flex flex-col w-full max-w-md rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/10">
          <span className="text-sm font-semibold">Sprint Intake — Launch Decomposition Agent</span>
          <button className="btn btn-xs btn-ghost text-base-content/60" onClick={onClose}>✕</button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/60">Sprint / Brief document path</label>
            <input
              type="text"
              placeholder="/path/to/sprint.md or brief.txt"
              value={docPath}
              onChange={(e) => setDocPath(e.target.value)}
              className="input input-bordered input-sm w-full bg-base-100/50 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/60">Project</label>
            <select
              className="select select-bordered select-sm w-full bg-base-100/50"
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              <option value="">— Select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {needsPath && (
              <div className="flex items-center gap-2 mt-1 p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
                <span className="flex-1">No project folder set — needed to write sprint.md</span>
                <button
                  className="btn btn-xs btn-warning"
                  onClick={handlePickFolder}
                  disabled={pickingFolder}
                >
                  {pickingFolder ? 'Picking…' : 'Set folder'}
                </button>
              </div>
            )}

            {projectPath && selectedProject && (
              <div className="flex items-center gap-2 mt-1 text-[10px] text-base-content/40">
                <span className="truncate flex-1" title={projectPath}>{projectPath}</span>
                <button
                  className="btn btn-xs btn-ghost shrink-0"
                  onClick={handlePickFolder}
                  disabled={pickingFolder}
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/60">Repo</label>
            <select
              className="select select-bordered select-sm w-full bg-base-100/50"
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="text-[10px] text-base-content/40 border border-base-content/10 rounded p-2">
            The agent reads your doc, writes sprint.md to the project folder, and writes a draft JSON
            to AgentHub. When it finishes, a "draft ready" indicator appears next to the Sprint ↑ button.
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-base-content/10">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleLaunch}
            disabled={launching || !docPath.trim() || !selectedRepoId || !selectedProjectId || !projectPath}
          >
            {launching ? 'Launching…' : 'Launch Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If `window.agentHub.projects.update` or `window.agentHub.dialog.openDirectory` are missing from the bridge types, add them now (see Step 1).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/widgets/kanban/SprintIntakeModal.tsx
git commit -m "feat(kanban): add SprintIntakeModal with project.path check and inline folder picker"
```

---

## Task 6: SprintPreviewModal

Execute **original plan Task 6 unchanged**. No modifications needed. The `sprintPending` event and the confirm/reject IPC channels are all wired in Tasks 2 and 3 above.

---

## Task 7: KanbanBoard — draft-ready indicator + split Sprint ↑ behavior

**Files:**
- Modify: `src/renderer/src/widgets/kanban/KanbanCard.tsx`
- Modify: `src/renderer/src/widgets/kanban/KanbanBoard.tsx`

**Interfaces:**
- Consumes:
  - `TaskItem.blockedBy` (from Task 1)
  - `SprintIntakeModal` (Task 5)
  - `SprintPreviewModal` (Task 6)
  - `window.agentHub.on.draftReady(cb)` (Task 2)
  - `window.agentHub.kanban.sprintConfirmDraft(projectId)` (Task 2)
- Produces:
  - `KanbanCard` with `blockedByCount` prop and badge
  - `KanbanBoard` with draft-ready indicator and smart Sprint ↑ button

**Draft-ready state note:** The board needs to track which projects have a draft ready. Use `Map<string, string>` where key = `projectId`, value = `draftFilename`. When `draftReady` fires, add to the map. When a draft is confirmed, remove it.

- [ ] **Step 1: Add `blockedByCount` prop and badge to KanbanCard**

In `src/renderer/src/widgets/kanban/KanbanCard.tsx`, find the `KanbanCardProps` interface and add:

```typescript
  blockedByCount?: number
```

Update the function signature to destructure with default:

```typescript
export function KanbanCard({ task, agentColor, agentName, repoGlowColor, onSBARClick, blockedByCount = 0 }: KanbanCardProps) {
```

Find the footer div (the one containing the sprint/category/status labels) and add the blocked badge before the existing badges:

```typescript
{blockedByCount > 0 && (
  <span
    className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-warning/15 text-warning border-warning/30"
    title={`Blocked by ${blockedByCount} task${blockedByCount > 1 ? 's' : ''}`}
  >
    Blocked {blockedByCount}
  </span>
)}
```

- [ ] **Step 2: Update KanbanBoard**

Add these imports at the top of `src/renderer/src/widgets/kanban/KanbanBoard.tsx`:

```typescript
import { SprintIntakeModal } from './SprintIntakeModal'
import { SprintPreviewModal } from './SprintPreviewModal'
import type { SprintDraftReadyPayload } from '@shared/types/task.types'
```

Add state declarations (inside the component):

```typescript
  const [sprintIntakeOpen, setSprintIntakeOpen] = useState(false)
  const [intakeDir, setIntakeDir] = useState('')
  // Map<projectId, draftFilename>
  const [draftMap, setDraftMap] = useState<Map<string, string>>(new Map())
```

In the existing `useEffect` for initial data load, add:

```typescript
    window.agentHub.system.getIntakeDir().then((res) => {
      if (res.success) setIntakeDir(res.data)
    })
```

Add a separate `useEffect` to subscribe to draft-ready events:

```typescript
  useEffect(() => {
    return window.agentHub.on.draftReady((raw) => {
      const payload = raw as SprintDraftReadyPayload
      setDraftMap((prev) => new Map(prev).set(payload.projectId, payload.draftFilename))
    })
  }, [])
```

Replace the existing "Sprint ↑" button (or add one if not present) in the toolbar with this smart version:

```typescript
{/* Sprint ↑ button — behavior depends on whether a draft is ready for the active project */}
{(() => {
  // If a project is active in the filter and has a draft, show the confirm path
  const activeDraft = activeProjectId ? draftMap.get(activeProjectId) : undefined
  if (activeDraft) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          className="btn btn-sm btn-primary"
          onClick={async () => {
            const res = await window.agentHub.kanban.sprintConfirmDraft(activeProjectId!)
            if (res.success) {
              setDraftMap((prev) => {
                const next = new Map(prev)
                next.delete(activeProjectId!)
                return next
              })
            }
          }}
          title="Import sprint draft into Kanban"
        >
          Sprint ↑
        </button>
        <span className="text-[10px] text-base-content/50">· draft ready</span>
      </div>
    )
  }
  return (
    <button
      className="btn btn-sm btn-ghost"
      onClick={() => setSprintIntakeOpen(true)}
      title="Import sprint from doc"
    >
      Sprint ↑
    </button>
  )
})()}
```

> **Note:** `activeProjectId` is the currently selected project filter value. Find where the project filter state is declared in `KanbanBoard` and use that variable name. If the filter value is `'all'` or `''`, treat it as no active project (no draft button).

In `renderSections` (or wherever `<KanbanCard>` is rendered), add the `blockedByCount` prop:

```typescript
<KanbanCard
  key={task.id}
  task={task}
  agentColor={getAgentColor(task.agentId)}
  agentName={getAgentName(task.agentId)}
  repoGlowColor={getRepoGlowColor(task.repoId)}
  blockedByCount={task.blockedBy?.length ?? 0}
/>
```

At the bottom of the returned JSX, before the closing `</div>`:

```typescript
<SprintIntakeModal
  isOpen={sprintIntakeOpen}
  onClose={() => setSprintIntakeOpen(false)}
  intakeDir={intakeDir}
/>
<SprintPreviewModal />
```

- [ ] **Step 3: Add `system.getIntakeDir` IPC (if not already present)**

Check whether `window.agentHub.system.getIntakeDir` exists:

```bash
grep -n 'getIntakeDir\|GET_INTAKE_DIR' src/preload/index.ts src/shared/constants/ipc-channels.ts
```

If not found, add:

In `src/shared/constants/ipc-channels.ts`:
```typescript
  SYSTEM: {
    // ... existing entries ...
    GET_INTAKE_DIR: 'system:get-intake-dir'
  },
```

In the system IPC handler file (check `src/main/ipc/system.ipc.ts` or `src/main/ipc/`):
```typescript
ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_INTAKE_DIR, () => {
  return { success: true, data: require('path').join(app.getPath('userData'), 'sprint-intake') }
})
```

In `src/preload/index.ts`:
```typescript
    getIntakeDir: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_INTAKE_DIR),
```

In `src/shared/types/ipc.types.ts`:
```typescript
    getIntakeDir: () => Promise<IpcResponse<string>>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test the full flow manually**

1. Start the app: `npm run dev`
2. Open the Kanban board.
3. Click "Sprint ↑" (no draft exists) → SprintIntakeModal should open.
4. Select a project that has no `path` set → "Set folder" prompt should appear inline.
5. Pick a folder → path should show below the project selector.
6. Write a test draft file manually to simulate the agent finishing:

```bash
# Replace <project.id> with the actual project UUID from your DB
PROJECT_ID="<project.id>"
INTAKE="$HOME/Library/Application Support/agenthub/sprint-intake"
cat > "$INTAKE/sprint-${PROJECT_ID}.draft.json" << 'EOF'
{
  "sprintName": "Sprint Test — Manual",
  "repoId": "<paste a real repoId>",
  "projectName": "My Project",
  "epics": [
    {
      "name": "Auth",
      "tasks": [
        { "localId": "t1", "title": "Write JWT helpers", "description": "sign/verify tokens", "priority": 1 },
        { "localId": "t2", "title": "Add route guard", "description": "middleware", "priority": 2, "dependsOn": ["t1"] }
      ]
    }
  ]
}
EOF
```

7. The Kanban board should show "Sprint ↑  · draft ready" in the header (for the matching project filter).
8. Click "Sprint ↑" → SprintPreviewModal should appear with 1 epic, 2 tasks, 1 dependency.
9. Click "Import to Kanban" → two tasks appear in Backlog under "Auth" section.
10. The "route guard" card should show "Blocked 1" badge.
11. The draft file should be gone from the intake directory.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/widgets/kanban/KanbanCard.tsx \
        src/renderer/src/widgets/kanban/KanbanBoard.tsx
git commit -m "feat(kanban): add draft-ready indicator, smart Sprint ↑ button, and blocked-by badge on KanbanCard"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Covered by |
|---|---|
| Two file outputs: sprint.md + .draft.json | Task 4 — prompt instructs agent to write both |
| sprint.md at `{project.path}/sprint.md` | Task 4 — projectPath in prompt; Task 5 — projectPath resolved from project |
| .draft.json at `{userData}/sprint-intake/sprint-{project.id}.draft.json` | Task 5 — draftFilename = `sprint-${selectedProjectId}.draft.json` |
| SprintWatcher ignores `.draft.json` | Task 3 — watch callback filters out `.draft.json`, only fires on `.json` |
| SprintWatcher emits DRAFT_READY when `.draft.json` detected | Task 3 — both in `start()` watch callback and `startupScan()` |
| Draft persists between sessions | Task 3 — `startupScan()` re-emits DRAFT_READY on next app start |
| One draft per project (deterministic filename) | Task 5 — `sprint-${project.id}.draft.json`; Task 3 — overwrite is safe, same path |
| User-triggered import via "Sprint ↑" | Task 7 — button calls `sprintConfirmDraft` when draft is ready |
| Draft-ready indicator in Kanban header | Task 7 — `draftMap` state + "· draft ready" label |
| Rename flow: `.draft.json` → `.json` | Task 3 — `confirmDraft()` calls `renameSync`; watch fires and calls `parseAndStage` |
| SprintPreviewModal with epic/task/dep counts | Task 6 — unchanged from original plan |
| Confirm → tasks in Backlog | Task 3 — `confirm()` two-pass insert |
| Discard → draft file deleted | Task 3 — `reject()` calls `unlinkSync` |
| project.path required; inline folder picker if missing | Task 5 — warning + "Set folder" button calls `dialog.openDirectory` |
| `project.path` persisted when picked | Task 5 — calls `projects.update(id, { path })` |
| Two-pass dependency insert | Task 3 — `confirm()` pass 1 inserts tasks, pass 2 inserts deps |
| Blocked-by badge on KanbanCard | Task 7 — `blockedByCount` prop + badge |
| `blockedBy` field on TaskItem | Task 1 — from original plan |
| task_dependencies DB table | Task 1 — migration 022 |
| macOS fs.watch reliability for `.json` files | Improved: rename is atomic; watch fires reliably for a rename event |
| Repo existence validated before insert | Task 3 — `confirm()` checks repo before insert loop |
| Duplicate sprint guard | Task 3 — `confirm()` checks COUNT before insert |
| Payload validation (priority, unique localIds, valid dependsOn refs) | Task 3 — `validateSprintPayload()` in `parseAndStage` |

**No placeholders detected.**

**Type consistency:**
- `SprintDraftReadyPayload.projectId` used in `draftMap`, `confirmDraft(projectId)`, `sprintConfirmDraft(projectId)` — consistent.
- `draftFilename = sprint-${selectedProjectId}.draft.json` (Task 5) matches `sprint-${projectId}.draft.json` in `confirmDraft` (Task 3) — consistent.
- `blockedBy: string[]` on `TaskItem` (Task 1), `blockedByCount={task.blockedBy?.length ?? 0}` (Task 7) — consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-sprint-intake.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
