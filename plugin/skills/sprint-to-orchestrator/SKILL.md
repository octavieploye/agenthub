---
name: sprint-to-orchestrator
description: Validate a sprint against the codebase (risks, conflicts, debt, inconsistencies) then dispatch it to the Kanban orchestrator. Blocks launch until all checks pass.
category: dev-skills
---

# Sprint to Orchestrator

Takes a sprint from any entry point (JSON, plan doc, Kanban tasks, NL description), validates it against the live codebase and sprint history, and dispatches it to the Kanban orchestrator only after all checks pass.

## When to Use
- Launching a new sprint through the orchestrator
- Validating a sprint plan before execution
- Catching code conflicts, tech debt, or blocker issues before an agent runs
- Converting a plan doc or JSON sprint into Kanban tasks and dispatching

## What You Need Before Starting
- Sprint definition: one of:
  - **Existing sprint name** already in Kanban (e.g. `AEC-T1: Landing Page Scaffold`)
  - **JSON file** with task definitions
  - **Plan document** (`.md` file with sprint description)
  - **Natural language** description of what the sprint should do
- **Repo target** confirmed by user (full local path + repoId UUID)
- User confirmation before dispatch (non-negotiable gate)

---

## Phase 0 — Sprint Intake

### 0A — If sprint is already in Kanban
```
mcp__agenthub-kanban__list_tasks(sprintName: "<sprint-name>")
```
Capture all tasks. Verify at least 1 task exists. If 0 → stop, report sprint not found.

### 0B — If sprint is a plan doc or NL description
Parse the sprint into tasks. For each task create:
```
mcp__agenthub-kanban__create_task({
  title: "<task title>",
  description: "<detailed instructions>",
  priority: 1 | 2,
  category: "backend" | "frontend",
  sprintName: "<sprint-name>",
  repoId: "<repo-uuid>",
  requiresApproval: true  ← set true on any task touching critical paths (see Phase 1 list)
  blockedBy: ["<id>"]     ← chain tasks that depend on prior ones
})
```
Create all tasks, capture their IDs.

### 0C — Confirm sprint shape
Report task list to user: titles, priorities, dependency chain, requiresApproval flags.
Ask: "Does this sprint shape look correct before validation?"

---

## Phase 1 — Pre-Flight Validation

Run all checks. Produce a finding per check. Do NOT dispatch until all checks are resolved.

### Check 1 — Sprint inventory (anamnesis)
```
mcp__anamnesis__recall(query: "sprint inventory for <repo-name>", domain: "sprint_inventory")
```
Flag if: work is already `done` or `in_progress` for the same area. This prevents duplicate sprints.

### Check 2 — Prior work in same area
```
mcp__anamnesis__recall(query: "<sprint description keywords>")
```
Flag if: prior sprint in same area failed, was abandoned, or produced known debt.

### Check 3 — Blocker resolution
For each task with `blockedBy` set: verify the blocking task has status `completed` or `tested`.
```
mcp__agenthub-kanban__list_tasks(sprintName: "<sprint-name>")
```
Flag if: any blocking task is `backlog`, `in_progress`, or `interrupted`.

### Check 4 — Code risk scan
For each task: grep the target repo for files/functions mentioned in the task description.
Flag as HIGH RISK if any task touches:

| Path pattern | Risk reason |
|---|---|
| `src/main/db/migrations/` | DB schema change — irreversible |
| `src/main/ipc/` | IPC contract — breaks renderer/main sync |
| `src/main/services/orchestrator*.ts` | Orchestrator core — self-referential risk |
| `src/main/services/agent-manager.ts` | Agent lifecycle — crash cascade risk |
| `src/shared/types/` | Type contracts — breaks across the codebase |
| `src/shared/constants/ipc-channels.ts` | IPC channel names — silent breakage |
| `*.mcp.json` / `mcp-bridge-handler.ts` | MCP contract — breaks all agent sessions |
| Auth / token / secret handling | Security boundary |

For HIGH RISK files: grep for `TODO|FIXME|HACK|DEBT|@deprecated` in the file.
Report any found as pre-existing tech debt that the sprint may worsen.

### Check 5 — Dependency audit (if sprint introduces new packages)
```
mcp__agenthub-kanban__audit_deps(repoId: "<repo-uuid>")
```
Flag any new dependency that has known vulnerabilities or is deprecated.

---

## Phase 2 — Validation Report

Present findings to user before any dispatch:

```
SPRINT VALIDATION REPORT — <sprint-name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tasks:    <N> tasks, <N> with requiresApproval
Blockers: <CLEAR | X tasks still blocking>

CHECK 1 — Sprint inventory:    [PASS | FLAG: <finding>]
CHECK 2 — Prior work recall:   [PASS | FLAG: <finding>]
CHECK 3 — Blocker resolution:  [PASS | FLAG: <finding>]
CHECK 4 — Code risk scan:      [PASS | HIGH RISK: <files> | MEDIUM: <files>]
CHECK 5 — Dependency audit:    [PASS | SKIP (no new deps) | FLAG: <finding>]

RECOMMENDATION: [GO | HOLD — resolve flags first]
```

If any check has a FLAG or HIGH RISK finding: present to user and ask for explicit GO/HOLD decision.
If all checks PASS: ask for confirmation to dispatch.

---

## Phase 3 — Orchestrator Dispatch

Only after user explicitly confirms GO:

```
mcp__agenthub-kanban__dispatch_sprint(
  sprintName: "<sprint-name>",
  repoId: "<repo-uuid>",
  confirmed: true,
  concurrencyCap: 3
)
```

Verify the response:
- Run ID is new (not an existing paused/running run)
- Status is `running`

If `dispatch_sprint` returns an existing run → the previous run must be cleared first.
Use the `sprint-reset` skill (mode: `reset`) to close the old run, then re-dispatch.

Report to user:
```
DISPATCHED: <sprint-name>
Run ID:     <new-run-id>
Status:     running
Tasks:      <N> queued, approval gate on <N> tasks
```

---

## Output

| Phase | Artifact |
|---|---|
| Phase 0 | Task list in Kanban with confirmed shape |
| Phase 2 | Validation report (pass/flag per check) |
| Phase 3 | Active run ID with status `running` |

## Constraints
- Never dispatch without user confirmation — the GO gate is non-negotiable
- Never skip Phase 1 — validation is the core purpose of this skill
- Never suppress HIGH RISK findings — present them even if user is in a hurry
- If sprint already has an active run → use `sprint-reset` (reset mode) before dispatching
- requiresApproval must be set to `true` on any task touching HIGH RISK paths
- Do not create duplicate tasks — always run `list_tasks` first to check if tasks exist

## Common Mistakes

| Mistake | Fix |
|---|---|
| Dispatching before validation | Phase 1 is mandatory — never jump to Phase 3 |
| Missing the `sprint-reset` step when an active run exists | `dispatch_sprint` returns existing run silently — check run ID matches |
| Setting `blockedBy` incorrectly | Verify dependency direction: blocker must complete BEFORE dependent |
| Not setting `requiresApproval` on HIGH RISK tasks | These tasks need human sign-off before the orchestrator executes them |
| Assuming anamnesis sprint inventory is current | Always re-query — inventory may lag by a few commits |
