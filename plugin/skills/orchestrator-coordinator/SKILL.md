---
name: orchestrator-coordinator
description: A-to-Z sprint dispatcher — resolves repo UUID, builds tasks with correct dependsOn chains, dispatches with telegramNotify, monitors approval gates. Encodes all orchestrator mechanics so setup is flowless.
category: dev-skills
---

# Orchestrator Coordinator

Full pipeline: from a sprint plan or NL description → kanban tasks created → dispatched to orchestrator → approval gates monitored → sprint completes. No friction, no silent failures.

Use this conversation as the reference for what NOT to do: https://github.com/anthropics — every obstacle encountered in 2026-09-12 session is encoded here as a rule.

## When to Use
- Dispatching any sprint to the orchestrator (replaces manual sprint-json-builder + dispatch steps)
- Sprint plan already exists as a `.md` file, JSON, or NL description
- Any time the user says "run this sprint", "dispatch this to orchestrator", or "task X"

## What You Need Before Starting
- **Sprint definition**: one of:
  - Plan doc path (e.g. `docs/sprints/voice-p2-p7-followup-sprint-plan.md`)
  - JSON sprint intake file (e.g. `*-sprint-intake.json`)
  - Natural language description of tasks
  - Existing sprint name already in Kanban
- **Target repo**: confirmed by user — full local path (NEVER assume CWD)

---

## CRITICAL RULES (encode before anything else)

### R1 — Always use the live runtime DB for repo UUIDs
The workspace `agenthub.db` at `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/agenthub.db` is a stale dev copy. The live DB is at `/Users/octaviesmacpro/Library/Application Support/agenthub/agenthub.db`. UUIDs differ. Using workspace UUIDs causes FK constraint failures in create_task with no clear error message.

Always query:
```bash
sqlite3 "/Users/octaviesmacpro/Library/Application Support/agenthub/agenthub.db" "SELECT id, name, path FROM repos ORDER BY name;"
```

### R2 — dependsOn uses actual DB task IDs, not localIds
create_task returns `result.id` (a UUID like `cc682d44-...`). The `dependsOn` parameter takes this UUID, not the localId from the sprint plan (like `VP2P7-T0`). Tasks must be created sequentially: T0 first → capture UUID → T1 with `dependsOn: ["<T0-uuid>"]`.

### R3 — telegramNotify: true is mandatory when any task has requiresApproval: true
Source-verified (orchestrator-scheduler.ts line 424): Telegram notification only fires if `run.telegramNotify === true`. There is NO approval button in the AgentHub UI. If `telegramNotify: false`, tasks with `requiresApproval: true` deadlock silently — no notification fires anywhere.

Rule: if ANY task in the sprint has `requiresApproval: true`, dispatch with `telegramNotify: true`.

If telegramNotify was set to false by mistake on an already-running run: call `dispatch_sprint` again with `telegramNotify: true` — the scheduler updates the existing run (safe).

### R4 — SprintWatcher only watches agenthub's own docs/sprints/
File-drop path is `<agenthub-root>/docs/sprints/*-sprint-intake.json`. Dropping a file into the target repo's sprint directory (e.g. `optimaeus/docs/sprints/`) does NOT trigger import. Always use Path B (MCP create_task + dispatch_sprint) for programmatic dispatch.

### R5 — Three approval paths (no UI button)
1. **Telegram** (primary): user replies `approve`/`deny` to bot message — requires `telegramNotify: true`
2. **MCP `mcp__agenthub-kanban__approve_task`** (fallback): programmatic approval, no Telegram needed
3. **IPC renderer** `orchestrator:approve-task`: internal — no exposed UI button

When approval is needed and Telegram isn't responding: use `mcp__agenthub-kanban__approve_task` directly with `{runId, taskId, approved: true}`.

### R6 — Tick timing
- Tick interval: 60s default
- After agent completes or approval granted: immediate tick fires (setTimeout 0)
- Throughput ceiling: 1 task dispatched per tick
- For T0→T1→T2 chain: minimum ~3 ticks but ~instant between steps due to immediate kick

### R7 — Only backlog/today tasks get dispatched
Tasks with status `in_progress`, `completed`, `tested`, or `interrupted` are skipped by the scheduler. Sprint tasks must have status `backlog` (default on create) to be picked up.

---

## Phase 0 — Pre-Flight Gate

### 0A — Repo confirmation
State the full repo path. If not confirmed by the user this session, STOP and ask:
> "Confirm: target repo is `<path>`?"

### 0B — Sprint name collision check
```
mcp__agenthub-kanban__list_tasks(sprintName: "<sprint-name>")
```
If tasks returned → sprint name taken. Options:
- Rename sprint (append `-v2` or date)
- Reset old sprint with `sprint-reset` skill (mode: reset)

### 0C — Resolve live repo UUID
```bash
sqlite3 "/Users/octaviesmacpro/Library/Application Support/agenthub/agenthub.db" \
  "SELECT id, name, path FROM repos WHERE path LIKE '%<repo-name>%';"
```
Capture the UUID. NEVER use the workspace DB. NEVER hardcode UUIDs (they change between machines and reinstalls).

---

## Phase 1 — Parse Sprint Definition

### From plan doc (`.md` file)
Read the file. Extract:
- Task list with titles and descriptions
- Dependency chain (which task blocks which)
- `requiresApproval` flags (any task touching DB migrations, IPC contracts, security boundaries, production code)
- Target files per task
- Recommended model (default: `claude-sonnet-4-6` for backend Python/TS changes)

### From NL description
Parse into tasks. Apply the `requiresApproval` rule:

| Always requiresApproval: true | Never requiresApproval |
|---|---|
| DB migrations | Test-only changes |
| IPC contract changes | Read-only investigation |
| Security/auth code | Documentation |
| Orchestrator core | Validation/reporting tasks |
| Production code (voice/LLM pipeline) | Utility/helper scripts |

### From existing JSON (`*-sprint-intake.json`)
Parse tasks array. Map `localId` → task object. Build the dependency chain as a graph before creating tasks (needed to resolve creation order).

### Output
Produce an internal task list:
```
T0: <title> | deps: [] | approval: false | model: claude-sonnet-4-6
T1: <title> | deps: [T0] | approval: true  | model: claude-sonnet-4-6
T2: <title> | deps: [T1] | approval: false | model: claude-sonnet-4-6
```
Present to user before creating tasks. Wait for confirmation.

---

## Phase 2 — Task Creation (sequential, capture IDs)

Create tasks ONE AT A TIME in dependency order (roots first). After each create_task call, capture the returned `result.id` UUID before proceeding.

```
T0_id = create_task({repoId, sprintName, epicName, title, description, priority, category,
                      skills, modelOverride, targetFiles, requiresApproval: false, dependsOn: []})
         → captures result.id

T1_id = create_task({..., requiresApproval: true, dependsOn: [T0_id]})
         → captures result.id

T2_id = create_task({..., requiresApproval: false, dependsOn: [T1_id]})
         → captures result.id
```

### Task field rules
| Field | Rule |
|---|---|
| `repoId` | Live DB UUID (Phase 0C) |
| `sprintName` | Exact string — must match across all tasks |
| `epicName` | Group name from sprint plan |
| `priority` | 1=critical (blocking), 2=high (sequential), 3=normal |
| `category` | `backend` / `frontend` / `devops` / `research` |
| `skills` | `["dev-backend"]` for Python/TS backend; `["dev-frontend"]` for UI; `["team-dev-loop"]` for multi-file |
| `modelOverride` | `claude-sonnet-4-6` default; `gemma4:31b-cloud` for complex multi-file |
| `targetFiles` | Full relative paths from repo root |
| `requiresApproval` | Follow Phase 1 rules |
| `dependsOn` | Actual DB UUIDs from previous create_task results |
| `description` | Agent's full prompt — include repo path, exact files, verification commands, commit rules |

### Description writing rules (critical for agent quality)
The `description` field IS the agent's execution prompt. Write it as if instructing a developer:
1. Start with what to do (not context)
2. State exact files to read/edit
3. Include expected test command and expected output
4. State commit rules explicitly (separate test commit vs impl commit if required)
5. Include STEP 0 notes for manual prerequisites (Docker restart, env vars, etc.)
6. End: "Do NOT proceed to [next step] — stop after this task."

---

## Phase 3 — Pre-Dispatch Validation (optional but recommended)

Run sprint-to-orchestrator checks on the created tasks:
```
mcp__anamnesis__recall(query: "sprint inventory for <repo-name>", domain: "sprint_inventory")
```
Flag if: work already done in the same area.

For any task touching HIGH RISK paths (DB migrations, IPC contracts, orchestrator core): set `requiresApproval: true` and report to user.

Skip this phase only for well-scoped, fully-investigated sprints where investigation was done in the same session.

---

## Phase 4 — Dispatch

### Determine telegramNotify flag
```
hasApproval = any task has requiresApproval: true
telegramNotify = hasApproval  ← MANDATORY (R3)
```

### Dispatch
```
mcp__agenthub-kanban__dispatch_sprint({
  sprintName: "<sprint-name>",
  repoId: "<live-uuid>",
  confirmed: true,
  concurrencyCap: 1,       ← 1 for sequential chains; 3 for parallel tasks
  telegramNotify: true/false
})
```

### Verify response
- `status: "running"` ✓
- Run ID is new (not an existing paused run)
- If `agentsSpawned: 0` — normal, orchestrator hasn't ticked yet

### If dispatch returns existing run
The previous run must be cleared first. Run `sprint-reset` (mode: reset) on the old run, then re-dispatch.

### Report to user
```
DISPATCHED: <sprint-name>
Run ID:     <run-id>
Status:     running
Telegram:   <on|off>

Task chain:
  T0 <id>  auto-dispatch
  T1 <id>  requiresApproval ← Telegram will ping for approval
  T2 <id>  auto-dispatch (after T1 approved + completes)
```

---

## Phase 5 — Post-Dispatch Monitoring

### Check status
```
mcp__agenthub-kanban__list_tasks(sprintName: "<sprint-name>")
```
Check `status` field per task. Expected progression:
- `backlog` → T0 dispatched
- `in_progress` (via agent_id set) → running
- `completed` / `tested` → done
- Task with requiresApproval stuck in `backlog` after T0 completes → awaiting approval

### Approval monitoring
When a `requiresApproval` task is ready but not dispatching after ~60s:
1. User should have received a Telegram message — ask if it arrived
2. If Telegram not working: use MCP approval directly:
   ```
   mcp__agenthub-kanban__approve_task({runId: "<run-id>", taskId: "<task-id>", approved: true})
   ```
3. After MCP approval: orchestrator kicks within seconds (immediate tick on approval)

### Sprint completion
Run concludes automatically when:
- All tasks in `completed`/`tested` status → run status becomes `completed`
- Any task fails after 1 retry → run status becomes `failed`
- Stale run (>2 hours no activity) → auto-recovered as `failed` on next app start

---

## Output

| Phase | Artifact |
|---|---|
| Phase 0 | Repo UUID confirmed, sprint name cleared |
| Phase 1 | Task list with dependencies and approval flags |
| Phase 2 | N tasks in Kanban with correct dependsOn chains |
| Phase 4 | Active run ID, `status: running` |
| Phase 5 | Sprint completion status per task |

---

## Constraints
- Never use workspace `agenthub.db` for UUID lookups — always live DB (R1)
- Never set `dependsOn` using localIds — always actual DB UUIDs (R2)
- Never dispatch with `telegramNotify: false` when any task has `requiresApproval: true` (R3)
- Never drop sprint JSON to target repo expecting SprintWatcher pickup (R4)
- Never tell user to "find the approval button in AgentHub" — it does not exist (R5)
- Never create tasks in parallel when they have sequential dependencies
- Never skip repo gate confirmation — always confirm full path before creating any task

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using workspace agenthub.db UUIDs | Always query live DB in Application Support |
| Setting dependsOn with plan localIds (T0, T1) | Capture `result.id` from each create_task call |
| Dispatching with telegramNotify: false when approval gates exist | Check: `hasApproval → telegramNotify: true` |
| Sprint name collision (already in Kanban) | list_tasks first; rename or sprint-reset |
| File drop to target repo → nothing happens | Use create_task + dispatch_sprint (Path B) |
| Approval task stuck, user never got Telegram | Use mcp__agenthub-kanban__approve_task fallback |
| Single concurrencyCap but tasks are parallel | Use concurrencyCap: 3 for independent tasks |
| Empty description → agent hallucinates scope | Description IS the prompt — be explicit and complete |

## Orchestrator Mechanics Reference

Full source-verified reference: see memory file `project_orchestrator_mechanics.md`

Key numbers:
- Tick interval: **60s** (immediate kick after completion/approval)
- Throughput ceiling: **1 task per tick**
- Retry on failure: **1 automatic retry**
- Stale run recovery: **2 hours** of inactivity → auto-failed
- maxAgents: **50** (hardcoded in scheduler deps)
- Status for dispatch eligibility: **backlog** or **today** only
