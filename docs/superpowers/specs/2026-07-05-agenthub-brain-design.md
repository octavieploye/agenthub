# AgentHub Brain — Design Spec
**Date:** 2026-07-05
**Status:** approved
**Repo:** hephaestus / agenthub

---

## Problem

Users work across multiple repos and projects simultaneously, across many sessions and turns. Brainstorms, specs, and implementation plans accumulate as `.md` files scattered across repos with no consistent location or naming. There is no unified view of what was done, what is in progress, and what was ideated but never actioned. Agents re-brainstorm or re-plan work that already exists because they have no memory of prior artifacts.

---

## Goal

A cross-repo, cross-project intelligence panel ("the Brain") that:

1. Tracks every brainstorm, spec, plan, and sprint per repo and project
2. Shows lifecycle stage and progress at a glance — from idea to implemented or parked
3. Surfaces "not yet actioned" artifacts so nothing is forgotten or duplicated
4. Injects a per-repo artifact index into `.claude/` at agent spawn time so agents never duplicate existing work

---

## Artifact Convention

### `docs/brain/` — the index folder

Each repo gets a `docs/brain/` folder. Artifacts (brainstorm docs, specs, plans) live wherever they are created. Agents register them by writing a small pointer file into `docs/brain/`.

**Rule (added to CLAUDE.md and all agent skills):**
> After creating any brainstorm, spec, or plan document, write a pointer file to `docs/brain/` in the same repo.

### Pointer file naming

```
docs/brain/YYYY-MM-DD-<subject-slug>-<type>.md
```

Examples:
```
docs/brain/2026-07-05-token-optimizer-spec.md
docs/brain/2026-06-24-kanban-redesign-brainstorm.md
docs/brain/2026-07-03-telegram-persistence-plan.md
```

### Pointer file format

```yaml
---
type: brainstorm | spec | plan | sprint
subject: "Human-readable feature name"
project: "Project name (matches projects table, optional)"
path: "relative/path/to/actual/artifact.md"
status: draft | active | parked | implemented
created_at: YYYY-MM-DD
note: "Optional annotation or review comment"
---
Optional one-line human note about this artifact.
```

### Lifecycle stages

```
brainstorm → spec → plan → sprint tasks → implemented
                                        → parked (at any stage)
```

The brain infers the lifecycle stage from the artifact type and whether linked sprint tasks exist in the kanban DB.

---

## Architecture

### Approach: DB-backed brain with filesystem sync

Brain entries are indexed into a local SQLite table. The filesystem is the source of truth; the DB is the queryable cache. At spawn time, the DB is queried to inject a `brain_index.md` into `.claude/`.

---

## Data Model

### Migration 028 — `brain_entries` table

```sql
CREATE TABLE brain_entries (
  id              TEXT PRIMARY KEY,
  repo_id         TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
  pointer_path    TEXT NOT NULL UNIQUE,   -- absolute path to docs/brain/*.md
  artifact_path   TEXT NOT NULL,          -- absolute path to actual artifact doc
  type            TEXT NOT NULL CHECK(type IN ('brainstorm','spec','plan','sprint')),
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK(status IN ('draft','active','parked','implemented')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_to_anamnesis INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_brain_entries_repo    ON brain_entries(repo_id);
CREATE INDEX idx_brain_entries_project ON brain_entries(project_id);
CREATE INDEX idx_brain_entries_status  ON brain_entries(status);
CREATE INDEX idx_brain_entries_type    ON brain_entries(type);
```

### Migration 029 — link tasks to brain entries

```sql
ALTER TABLE tasks ADD COLUMN brain_entry_id TEXT REFERENCES brain_entries(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_brain_entry ON tasks(brain_entry_id);
```

### Migration 030 — add note column to brain entries

```sql
ALTER TABLE brain_entries ADD COLUMN note TEXT;
```

---

## Backend: BrainScannerService

**File:** `src/main/services/brain-scanner.ts`

### Responsibilities

1. **Startup scan** — for every repo in the DB that has a valid path, glob `<repo_root>/docs/brain/*.md`, parse frontmatter, upsert rows into `brain_entries`
2. **File watcher** — watch `docs/brain/` in each known repo root using Node.js built-in `fs.watch` (no new dependency). On file change/rename → re-scan the directory and upsert or delete the affected row.
3. **Project linker** — if frontmatter `project` field is present, match against the `projects` table (case-insensitive name match) and set `project_id`
4. **Repo watcher** — when a new repo is added to AgentHub, start watching its `docs/brain/` immediately

### Frontmatter parser

Reads YAML frontmatter from pointer files. Required fields: `type`, `subject`, `path`, `status`, `created_at`. Optional: `project`, `note`. All other fields are ignored.

The `path` field in frontmatter is relative to the repo root. The service resolves it to an absolute path for `artifact_path`. The `note` field is stored in the DB and displayed in the UI as an annotation.

### Task aggregation (query time, not scan time)

When the brain panel queries for entries, the service joins `brain_entries` with `tasks` on `brain_entry_id` to compute:

- `tasks_total` — count of all linked tasks
- `tasks_done` — count where `status IN ('completed', 'tested')`
- `tasks_in_progress` — count where `status = 'in_progress'`

This is computed on read, not stored, to stay in sync with the kanban automatically.

### Timeline event merging

The `brain:timeline` endpoint merges two event streams:

1. **Brain events** — from `brain_entries` table: `created_at` and `updated_at` timestamps
2. **Git events** — from `git log` via GitService: commit timestamps and messages

Both streams are normalized to `BrainTimelineEntry`:

```typescript
export interface BrainTimelineEntry {
  id: string
  repoId: string
  date: string
  type: 'brain' | 'git'
  subject: string
  details?: string
  icon: 'brain' | 'git-commit'
}
```

The service polls git every 30s for active repos and merges events chronologically.

### IPC channels

| Channel | Input | Output |
|---|---|---|
| `brain:query` | `{ repoId?: string }` | `BrainQueryResult[]` grouped by repo |
| `brain:update-status` | `{ id, status }` | updates DB row + rewrites frontmatter in pointer file |
| `brain:register` | `{ repoId, subject, type, artifactPath, project?, note? }` | writes pointer file + upserts DB row |
| `brain:timeline` | `{ repoId: string }` | `BrainTimelineEntry[]` — merged brain+git events sorted chronologically |
| `brain:create-task` | `{ brainEntryId: string, subject?: string, description?: string }` | creates kanban task linked to brain entry |

---

## Agent Spawn Injection

**Extends:** `writeWorkspaceMemory` in `src/main/services/workspace-memory-writer.ts`

At agent spawn, after writing `workspace_memory.md`, the system also:

1. Queries `brain_entries` for the agent's `repo_id`, ordered by `updated_at DESC`
2. Builds `brain_index.md` with three sections
3. Writes to `<repo_root>/.claude/brain_index.md`

### `brain_index.md` format

```markdown
<!-- Auto-generated by agenthub. Do not edit. Regenerated on every spawn. -->
# Brain Index — {repo name}

## Active & In Progress
- **{subject}** [{type} -> sprint] {tasks_done}/{tasks_total} tasks done
  Path: {artifact_path}
  Note: {note}

## Not Yet Actioned
- **{subject}** [{type}] — no sprint tasks yet. Decide: implement, plan, or park.
  Path: {artifact_path}
  Note: {note}

## Parked
- **{subject}** [{type}] — parked {created_at}
  Path: {artifact_path}
  Note: {note}

## Implemented
- **{subject}** — completed
  Path: {artifact_path}
  Note: {note}
```

**Agent contract:** Before creating any brainstorm, spec, or plan, the agent MUST check the "Not Yet Actioned" and "Active" sections. If a matching artifact exists, reference it — do not create a duplicate.

---

## Frontend: BrainPanel

**File:** `src/renderer/src/widgets/brain-panel/BrainPanel.tsx`

### Panel structure

Registered as a sidebar panel alongside Kanban and Activity Log.

```
Brain                                        [↻ Refresh]  [Timeline]

[+ Register artifact]

● agenthub                        2 active · 1 parked · 3 done
  Token Optimizer    plan→sprint   ████░░  3/5    IN PROGRESS   [open]
    docs/superpowers/specs/2026-07-05-token-optimizer-spec.md
    "Needs validation sprint before implementation"
    [+ Task]
  Kanban Redesign    spec          ──────         ⚠ NOT ACTIONED [open]
    docs/superpowers/specs/2026-06-24-kanban-redesign-spec.md
    [+ Task]
  Telegram Fix       sprint        ██████  done   IMPLEMENTED

● optimaeus
  Anamnesis Layer    brainstorm    ──────         PARKED
    docs/brainstorm/2026-07-01-anamnesis-layer-brainstorm.md
  Hermes Crawler     plan→sprint   ███░░░  2/6    IN PROGRESS   [open]
    docs/superpowers/plans/2026-07-03-hermes-crawler-plan.md
    [+ Task]
```

### Components

| Component | Purpose |
|---|---|
| `BrainPanel.tsx` | Top-level panel, fetches via `brain:query`, renders repo groups |
| `BrainRepoGroup.tsx` | Collapsible section per repo with summary counts |
| `BrainEntryRow.tsx` | Single artifact row: subject, type badge, progress bar, status badge, open button, path display |
| `BrainRegisterModal.tsx` | Form: repo selector, subject, type, artifact path picker, optional project + note |
| `BrainTimelineView.tsx` | Timeline view merging brain entries with git commits |
| `BrainTimelineEntry.tsx` | Single timeline entry (brain event or git commit) |

### Status badge colours (DaisyUI)

| Status | Badge |
|---|---|
| `draft` | ghost |
| `active / in_progress` | primary |
| `not_actioned` (inferred) | warning |
| `parked` | neutral |
| `implemented` | success |

### Interactions

- **[open]** — calls `shell:open-path` IPC (new handler added to `system.ipc.ts` using Electron's `shell.openPath()`), opens the artifact in the OS default editor
- **Status click** — dropdown to change status (`active → parked`, `parked → active`). Calls `brain:update-status`, which rewrites the pointer file frontmatter and updates the DB row
- **[+ Register artifact]** — opens `BrainRegisterModal`. On submit, calls `brain:register`
- **Repo group header** — click to collapse/expand the repo's entries
- **[+ Task]** — opens lightweight task creation modal pre-filled with brain entry subject and auto-sets `brain_entry_id`. Calls `kanban:create-task` with pre-filled fields
- **Path display** — shows relative artifact path under each entry as muted text
- **Timeline tab** — second view tab showing merged brain+git timeline with auto-refresh

---

## CLAUDE.md Rule Addition

The following rule is added to `.claude/CLAUDE.md` in this repo and recommended for all Optimaeus repos:

```markdown
## Brain Index — Artifact Registration

After creating any brainstorm, spec, or plan document, you MUST write a pointer
file to `docs/brain/` in the same repo using this format:

Filename: `docs/brain/YYYY-MM-DD-<subject-slug>-<type>.md`
Types: brainstorm | spec | plan | sprint

Frontmatter:
---
type: <type>
subject: "<Human-readable feature name>"
project: "<Project name, optional>"
path: "<relative path to the actual artifact>"
status: draft
created_at: YYYY-MM-DD
note: "<Optional annotation or review comment>"
---

Before creating any new brainstorm, spec, or plan — check `.claude/brain_index.md`
first. If a matching artifact already exists, reference it instead of creating a duplicate.
```

---

## Shared Types

**File:** `src/shared/types/brain.types.ts`

```typescript
export type BrainEntryType = 'brainstorm' | 'spec' | 'plan' | 'sprint'
export type BrainEntryStatus = 'draft' | 'active' | 'parked' | 'implemented'

export interface BrainEntry {
  id: string
  repoId: string
  repoName: string
  projectId: string | null
  projectName: string | null
  pointerPath: string
  artifactPath: string
  type: BrainEntryType
  subject: string
  status: BrainEntryStatus
  createdAt: string
  updatedAt: string
  note?: string
  // Aggregated at query time from linked tasks
  tasksTotal: number
  tasksDone: number
  tasksInProgress: number
}

export interface BrainQueryResult {
  repoId: string
  repoName: string
  entries: BrainEntry[]
  summary: {
    active: number
    notActioned: number
    parked: number
    implemented: number
  }
}

export interface RegisterBrainEntryInput {
  repoId: string
  subject: string
  type: BrainEntryType
  artifactPath: string
  project?: string
  note?: string
}

export interface BrainTimelineEntry {
  id: string
  repoId: string
  date: string
  type: 'brain' | 'git'
  subject: string
  details?: string
  icon: 'brain' | 'git-commit'
}
```

---

## New Features Added

### 1. Repo/Project Path Display with Annotations

**UI Changes:**
- `BrainEntryRow.tsx`: Add muted text line showing relative `artifactPath`
- Display `note` field from frontmatter as italicized text below path
- Truncate long paths with ellipsis and tooltip on hover

**Backend Changes:**
- `brain-scanner.ts`: Parse and store `note` field from frontmatter
- `brain.queries.ts`: Include `note` in query results
- `brain.ipc.ts`: Return `note` in `BrainQueryResult`

**Database Changes:**
- Add `note TEXT` column to `brain_entries` table (Migration 030)

**Example Display:**
```
Token Optimizer    plan→sprint   ████░░  3/5    IN PROGRESS   [open]
  docs/superpowers/specs/2026-07-05-token-optimizer-spec.md
  "Needs validation sprint before implementation"
```

### 2. Add Task to Kanban Functionality

**UI Changes:**
- `BrainEntryRow.tsx`: Add `[+ Task]` button next to each entry
- `BrainTaskModal.tsx`: New lightweight modal with pre-filled form:
  - Subject: pre-filled with brain entry subject
  - Description: optional text area
  - Project: auto-selected if brain entry has project
  - Brain Entry: read-only display of linked entry

**IPC Changes:**
- `brain:create-task` channel: `{ brainEntryId, subject?, description? }`
- Calls existing `kanban:create-task` with `brain_entry_id` set

**Backend Changes:**
- `brain-scanner.ts`: Add `createTaskFromBrainEntry` method
- Links new task to brain entry via `brain_entry_id` foreign key

**Workflow:**
1. User clicks `[+ Task]` on brain entry
2. Modal opens with pre-filled subject
3. User adds description (optional)
4. Submit creates task in kanban with automatic linking
5. Brain panel refreshes to show updated task counts

### 3. Timeline View (Brain + Git Events)

**UI Changes:**
- `BrainPanel.tsx`: Add tab switcher `[Overview] [Timeline]`
- `BrainTimelineView.tsx`: Vertical timeline component:
  - Left column: date headers (Jul 5, Jul 6, etc.)
  - Right column: event entries with icons
  - Brain events: brain icon, blue color
  - Git events: git icon, green color
  - Auto-refresh every 30s or on manual refresh

**Backend Changes:**
- `brain-scanner.ts`: Add `getTimeline` method
- Merges `brain_entries` (created_at, updated_at) with git commits
- Normalizes both to `BrainTimelineEntry` interface
- Polls git every 30s for active repos

**IPC Changes:**
- `brain:timeline` channel: `{ repoId }` → `BrainTimelineEntry[]`

**Example Timeline:**
```
Jul 5
  ◆ spec created       "Token Optimizer"
  ◆ plan created       "Token Optimizer"

Jul 6
  ● git commit         "feat(token-optimizer): add pipeline"
  ● git commit         "fix(token-optimizer): gate logic"

Jul 7
  ◆ sprint started     "3 tasks created"
  ● git commit         "feat: complete phase 1"
```

**Auto-refresh Logic:**
- File watcher: brain entries (instant)
- Git poller: every 30s for repos with open brain entries
- Manual refresh button in UI

---

## Not In Scope (V1)

- Anamnesis sync (`synced_to_anamnesis` column scaffolded but not implemented)
- Cross-repo dependency tracking between brain entries
- AI-powered duplicate detection (agent reads `brain_index.md` manually)
- Automatic status advancement (e.g., auto-set `implemented` when all tasks done) — status is manual for now
- Brain entries for repos that are offline or have no path set
- Real-time git watching (polling every 30s is sufficient for V1)

---

## File Map

```
src/main/db/migrations/028-brain-entries.sql
src/main/db/migrations/029-brain-task-link.sql
src/main/db/migrations/030-brain-note-column.sql
src/main/db/queries/brain.queries.ts
src/main/services/brain-scanner.ts
src/main/ipc/brain.ipc.ts
src/shared/types/brain.types.ts
src/renderer/src/widgets/brain-panel/BrainPanel.tsx
src/renderer/src/widgets/brain-panel/BrainRepoGroup.tsx
src/renderer/src/widgets/brain-panel/BrainEntryRow.tsx
src/renderer/src/widgets/brain-panel/BrainRegisterModal.tsx
src/renderer/src/widgets/brain-panel/BrainTimelineView.tsx
src/renderer/src/widgets/brain-panel/BrainTimelineEntry.tsx
src/renderer/src/widgets/brain-panel/BrainTaskModal.tsx
```

Modifications:
```
src/main/services/workspace-memory-writer.ts   -- add brain_index.md injection
src/main/services/service-orchestrator.ts      -- register BrainScannerService
src/main/ipc/system.ipc.ts                     -- add shell:open-path handler (shell.openPath)
src/main/ipc/                                  -- register brain.ipc.ts
src/shared/constants/ipc-channels.ts           -- add BRAIN and SYSTEM.OPEN_PATH channels
.claude/CLAUDE.md                              -- add Brain Index rule
```

## Dependency Notes

No new npm dependencies required:
- File watching: Node.js built-in `fs.watch` (already available in Electron main process)
- YAML frontmatter parsing: use the `yaml` package (v2.8.2, already in `package.json`) — extract the `---` block with a regex, parse body with `yaml.parse()`
- File open: Electron built-in `shell.openPath()` (no new package needed)
