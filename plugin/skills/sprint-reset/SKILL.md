---
name: sprint-reset
description: Archive or reset an orchestrator sprint — archives tasks, clears the active run in the app DB, and optionally restores for fresh re-dispatch.
category: dev-skills
---

# Sprint Reset

Close or reset a Kanban orchestrator sprint. Archives tasks, clears the active run record, and optionally restores everything for a fresh re-dispatch.

## When to Use
- `dispatch_sprint` returns an existing run instead of creating a new one
- A sprint is stuck in `paused` or `running` and blocks re-dispatch
- Sprint is done, broken, or superseded and should be permanently archived
- Testing the orchestrator and need a clean slate between runs

## What You Need Before Starting
- **Sprint name** — exact string (e.g. `AEC-T1: Landing Page Scaffold`)
- **Mode** confirmed by user:
  - `archive` — close permanently (tasks archived, run completed, no re-dispatch)
  - `reset` — clean slate (tasks restored to backlog, run cleared, fresh dispatch)
- User confirmation before any DB write

## Critical: Two Databases

The agenthub system has two SQLite files — always use the app DB:

| File | Use |
|---|---|
| `~/Library/Application Support/agenthub/agenthub.db` | **App DB — always use this** |
| `<repo-root>/agenthub.db` | Empty shell, git-tracked — never use |

## Workflow

### Step 1 — Confirm inputs
Ask the user to confirm sprint name and mode (`archive` or `reset`). Do not write anything until confirmed.

### Step 2 — List sprint tasks
```
mcp__agenthub-kanban__list_tasks(sprintName: "<sprint-name>")
```
Capture all task IDs. If result is empty → stop and report (sprint may not exist or tasks were already archived).

### Step 3 — Archive all tasks (parallel)
```
mcp__agenthub-kanban__archive_task(taskId: "<id>")   ← one call per task, all in parallel
```
Each must return `{ ok: true }`.

### Step 4 — Clear the active run in the app DB
```bash
sqlite3 ~/Library/Application\ Support/agenthub/agenthub.db \
  "UPDATE orchestrator_runs SET status='completed', updated_at=datetime('now') \
   WHERE sprint_name='<sprint-name>' AND status IN ('running','paused'); SELECT changes();"
```
`changes()` must be ≥ 1. If 0 → run was already cleared, or sprint name does not match exactly.

> Valid run statuses (CHECK constraint): `idle | running | paused | completed | failed`
> `cancelled` is NOT a valid status — the DB will reject it with a constraint error.

**Archive mode ends here.** Report: tasks archived, run completed, sprint closed.

### Step 5 — Restore tasks to backlog (reset mode only)
```bash
sqlite3 ~/Library/Application\ Support/agenthub/agenthub.db \
  "UPDATE tasks SET status='backlog', updated_at=datetime('now') \
   WHERE id IN ('<id1>','<id2>','<id3>'); SELECT changes();"
```
Row count returned must match the number of tasks from Step 2.

### Step 6 — Re-dispatch (reset mode only)
```
mcp__agenthub-kanban__dispatch_sprint(
  sprintName: "<sprint-name>",
  repoId: "<repo-uuid>",
  confirmed: true,
  concurrencyCap: 3
)
```
Verify: returned run ID is **different** from the one cleared in Step 4, and status is `running`.

## Output

| Mode | Result |
|---|---|
| `archive` | Tasks: `archived` · Run: `completed` · Sprint closed |
| `reset` | Tasks: `backlog` · Old run: `completed` · New run: `running` with fresh ID |

## Common Mistakes

| Mistake | Fix |
|---|---|
| `status='cancelled'` in SQL | Use `status='completed'` — only `idle/running/paused/completed/failed` are valid |
| Querying repo-root `agenthub.db` | Always use `~/Library/Application Support/agenthub/agenthub.db` |
| Archiving tasks but skipping Step 4 | Both required — `getActiveRun` checks run status, not task status |
| `dispatch_sprint` returns same run ID | Run wasn't cleared — check that Step 4 returned `changes() > 0` |
| Restoring tasks (Step 5) but skipping re-dispatch (Step 6) | Leaves tasks in `backlog` with no active run — orchestrator won't pick them up |
| Sprint name case or whitespace mismatch in SQL | Copy the sprint name exactly from `list_tasks` output — do not retype |
