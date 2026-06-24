# Sprint Intake — Design Spec
**Date:** 2026-06-24
**Status:** Approved for dev AgentHub
**Scope:** Dev version only — business version UX (in-app editor, Create Sprint button) parked in `docs/business-version/sprint-intake-design.md`

---

## Problem

The existing `kanban-automation/plan.md` has a `SprintIntakeModal` where the user picks a document path and a decomposition agent is spawned. This design has two problems:

1. **File location is undefined** — where should the sprint file live so AgentHub can find it?
2. **Trigger is unreliable** — `fs.watch` fires on every file write, causing accidental imports mid-session when the agent is still editing the sprint.

---

## Context

- `projects.path` exists in the DB (migration 019) — the filesystem root of the linked project folder. Currently optional.
- `{userData}/sprint-intake/` is the directory `SprintWatcher` already watches for `sprint-*.json` files.
- The agent writes files during a brainstorming session and may modify the sprint many times before it is final.

---

## Design

### Two file outputs

Every sprint created by an agent produces exactly two files:

| File | Location | Purpose |
|---|---|---|
| `sprint.md` | `{project.path}/sprint.md` | Human-readable. Team can read it, commit it to git, share it. |
| `sprint-{project.id}.draft.json` | `{userData}/sprint-intake/sprint-{project.id}.draft.json` | Structured JSON. AgentHub reads this to create Kanban tasks. |

The agent writes **both files** in the same operation. The human version is written first; the draft JSON is written last.

The filename uses `project.id` (the project's existing UUID from the DB) as the unique key — not a freshly generated UUID. This guarantees exactly one draft file per project and makes the filename deterministic.

The `.draft.json` extension is intentional — `SprintWatcher` ignores `.draft.json` files. Only `.json` files (no `.draft`) trigger the import flow.

---

### Draft persistence

The `.draft.json` file persists between sessions. Closing AgentHub does not delete it.

- If the agent modifies the sprint mid-session, it overwrites both files. No trigger fires.
- If the user changes direction entirely, the agent rewrites both files from scratch.
- If the user closes AgentHub and returns later, the draft is still there waiting.

One draft per project at a time. If the agent creates a new sprint for the same project, it overwrites `sprint.md` and overwrites the existing `sprint-{project.id}.draft.json` in place.

---

### User-triggered import

**The import is always triggered by the user — never automatically.**

When a `.draft.json` is present for a project, the Kanban board header shows a subtle indicator:

```
[Sprint ↑]  •  1 draft ready
```

The user clicks **"Sprint ↑"** (or the indicator) when they are satisfied with the sprint.

Flow:
1. AgentHub reads the current `sprint-{project.id}.draft.json`
2. Renames it to `sprint-{project.id}.json` (removes `.draft`)
3. `SprintWatcher` detects the renamed file
4. `SprintPreviewModal` appears — shows sprint name, epic count, task count, dependency count
5. User clicks **"Import to Kanban"** → tasks created in Backlog
6. Draft file is deleted after successful import
7. `sprint.md` in the project folder is kept — permanent human record

If the user clicks **"Discard"** in the preview modal, the draft file is deleted and `sprint.md` is left untouched.

---

### Mid-session changes

The user can ask the agent to add, remove, or reprioritize at any point during brainstorming. The agent overwrites both files. No trigger fires. The user clicks Import only when ready.

```
Session example:

Agent writes sprint draft + sprint.md
User: "add a security epic"     → agent overwrites both files
User: "remove the analytics tasks" → agent overwrites both files
User: "change auth to high priority" → agent overwrites both files
User: [satisfied] → clicks "Sprint ↑" → preview → confirm → Kanban
```

---

### Agent prompt additions

The `buildSprintDecompositionPrompt` function (from the existing plan) receives two additional fields:

```typescript
interface SprintPromptInput {
  docPath: string        // existing — path to the source document
  projectName: string    // existing
  repoId: string         // existing
  outputPath: string     // existing — {userData}/sprint-intake/
  projectPath: string    // NEW — {project.path}, where sprint.md is written
  draftFilename: string  // NEW — sprint-{project.id}.draft.json (computed by AgentHub before spawning agent)
}
```

The prompt instructs the agent to:
1. Write `{projectPath}/sprint.md` — plain markdown, human readable
2. Write `{outputPath}/{draftFilename}` — structured JSON, matching the `SprintIntakePayload` schema
3. Write the JSON **last**

---

### Kanban header indicator

`KanbanBoard` gains a `draftReady` boolean prop (or reads from store). When `true`:

```
[Sprint ↑]  ·  1 draft ready     ← subtle dot or badge next to the button
```

The indicator is read from a new store value populated when `SprintWatcher` detects a `.draft.json` file on startup or during a session.

---

### project.path requirement

`project.path` must be set for the sprint feature to work. If a project has no path set:
- The "Sprint ↑" button is visible but clicking it shows an inline prompt: "Set a project folder to enable sprint import."
- The user sets the path inline (a folder picker) — no navigation away from the board.

---

## File locations — cross-platform resolution

| Platform | `{userData}/sprint-intake/` |
|---|---|
| macOS | `~/Library/Application Support/agenthub/sprint-intake/` |
| Windows | `%APPDATA%\agenthub\sprint-intake\` |
| Linux | `~/.config/agenthub/sprint-intake\` |

`project.path` is whatever the user set — no platform assumption.

---

## What this changes in the existing plan

The `kanban-automation/plan.md` is not replaced — these are targeted additions:

| Existing | Change |
|---|---|
| `SprintWatcher` watches for `sprint-*.json` | Now ignores `*.draft.json` — only triggers on `sprint-{project.id}.json` (after rename) |
| `SprintIntakeModal` — user picks doc path | Now also receives `projectPath` and `draftFilename` to pass to the agent prompt |
| `buildSprintDecompositionPrompt` | Add `projectPath` and `draftFilename` params; add instruction to write `sprint.md` first |
| `KanbanBoard` header | Add draft-ready indicator next to "Sprint ↑" button |
| `SprintWatcher.start()` | On startup, scan intake dir for existing `.draft.json` files and emit draft-ready signal to renderer |

---

## Out of scope (business version)

- "Create Sprint" button with in-app editor
- Loading an existing user doc (Word, PDF, Notion export) via file picker
- Per-sprint versioning (sprint-1.md, sprint-2.md)
- Forgejo sync

These are documented in `docs/business-version/sprint-intake-design.md`.
