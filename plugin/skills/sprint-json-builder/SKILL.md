---
name: sprint-json-builder
description: Build a sprint intake JSON file from scratch and inject it into the AgentHub orchestrator. Covers schema, field semantics, model/skill/provider selection, and both injection paths (file drop + MCP).
category: dev-skills
---

# Sprint JSON Builder

Creates a valid sprint intake JSON file from a task description, plan doc, or natural language brief, then injects it into the AgentHub orchestrator for execution.

## When to Use
- You have a set of tasks to execute via the orchestrator but no sprint JSON exists yet
- You need to convert a plan, brief, or ad-hoc instructions into orchestrator-ready format
- You want to dispatch work to agents with correct model, skill, and dependency wiring

## Prerequisites
- **Repo UUID** — the target repo must be registered in AgentHub. Get it from `mcp__agenthub-kanban__get_context` or `Settings > Repos` in the UI
- **Repo path** — full local filesystem path to the target repo
- **Task scope** — what the sprint should accomplish (plan doc, NL description, or task list)

---

## Sprint JSON Schema

The file must conform to `SprintIntakePayload`. Minimal valid example:

```json
{
  "sprintName": "PROJ-S1: Feature Name",
  "repoId": "<repo-uuid>",
  "epics": [
    {
      "name": "Epic Name",
      "tasks": [
        {
          "localId": "T1",
          "title": "Task title",
          "description": "Detailed instructions for the agent",
          "priority": 1
        }
      ]
    }
  ]
}
```

### Top-Level Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `sprintName` | string | YES | Unique name. Convention: `PROJ-SN: Description`. Max 200 chars |
| `repoId` | string | YES | UUID of the target repo in AgentHub |
| `repoPath` | string | NO | Filesystem path — auto-resolves to repoId if repoId is omitted |
| `projectName` | string | NO | Human-readable project name — resolved to project UUID on import |
| `autoConfirm` | boolean | NO | Skip the import modal — insert tasks immediately |
| `autoStart` | boolean | NO | Start orchestrator after import (requires `autoConfirm: true`) |
| `preApproveAll` | boolean | NO | Override all `requiresApproval` flags to false |
| `epics` | array | YES | At least 1 epic. Max 50 epics |

### Epic Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | YES | Epic name — groups related tasks |
| `targetDate` | string | NO | ISO date string — informational deadline |
| `tasks` | array | YES | At least 1 task per epic |

### Task Fields (SprintStoryInput)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `localId` | string | YES | — | Unique within this JSON. Used for `dependsOn` references |
| `title` | string | YES | — | Short task title. Max 500 chars |
| `description` | string | YES | — | Full agent instructions. Be specific — this is the agent's prompt |
| `priority` | 1 \| 2 \| 3 | YES | — | 1=critical, 2=high, 3=normal. Orchestrator brain picks lowest number first |
| `category` | string | NO | null | `backend`, `frontend`, `devops`, `docs`, `research`, `design` |
| `dependsOn` | string[] | NO | [] | Array of `localId` values this task depends on. Blocks execution until deps complete |
| `requiresApproval` | boolean | NO | false | When true, orchestrator pauses before dispatching — waits for human approval |
| `skills` | string[] | NO | null | Skill/workflow to use. e.g. `["team-dev-loop"]`, `["dev-backend"]`, `["full-code-review"]` |
| `modelOverride` | string | NO | null | Force a specific model. e.g. `"gemma4:31b-cloud"`, `"qwen3:8b"` |
| `providerOverride` | string | NO | null | Force provider: `"ollama-local"`, `"ollama-cloud"`, `"anthropic"`, `"openai-codex"` |
| `recommendedModel` | string | NO | null | Soft preference — used if no `modelOverride`. Orchestrator brain config is final fallback |
| `targetFiles` | string[] | NO | null | File paths the agent should focus on. Injected into agent prompt as `Target files: ...` |
| `estimatedTokens` | number | NO | null | Estimated input token cost — used for budget tracking and logging |
| `riskScore` | number | NO | null | 0.0-1.0 risk score — logged for observability |

---

## Model / Skill / Provider Resolution

The orchestrator resolves these fields in priority order:

**Model:** `task.modelOverride` > `task.recommendedModel` > `brainConfig.model` (system default)

**Skill:** `task.skills[0]` > `"team-dev-loop"` (default)

**Provider:** `task.providerOverride` > model-name heuristic (`:cloud` suffix = ollama-cloud, local model regex = ollama-local) > `brainConfig.provider`

### Skill Selection Guide

| Skill | When to use |
|---|---|
| `team-dev-loop` | Default. Full agentic coding loop with scouts, devs, testers |
| `dev-backend` | Backend-only implementation |
| `dev-frontend` | Frontend-only implementation |
| `full-code-review` | Code review — no implementation, produces findings report |
| `team-impl-lead` | Multi-file implementation when scope is uncertain |
| `scout-backend` | Read-only backend investigation |
| `scout-frontend` | Read-only frontend investigation |

### Model Heuristic

| Task type | Recommended model |
|---|---|
| Simple, single-file | `qwen3:8b` (local) |
| Multi-file backend | `gemma4:31b-cloud` or `deepseek-v4-pro:0813:cloud` |
| Complex reasoning | `deepseek-v4-pro:0813:cloud` |
| Frontend/UI | `gemma4:31b-cloud` |
| Research/analysis | `mistral-large:cloud` |

---

## Phase 1 — Build the JSON

1. Identify all tasks from the input (plan, brief, NL description)
2. Assign each task a `localId` (convention: `PROJ-SN-N` e.g. `AEC-T1-1`)
3. Set `dependsOn` chains — tasks that need prior work must reference the blocker's `localId`
4. Set `requiresApproval: true` on tasks touching critical paths:
   - DB migrations
   - IPC contracts
   - Orchestrator core
   - Agent lifecycle
   - Security boundaries
   - Type contracts in `src/shared/types/`
5. Assign `skills` based on task type (see Skill Selection Guide)
6. Set `targetFiles` when the task scope is narrow and files are known
7. Set `modelOverride` or `recommendedModel` based on task complexity

### Description Writing Rules

The `description` field IS the agent's prompt. Write it like you're instructing a developer:
- Start with what to do, not context
- List specific files to create/modify
- Include expected outcomes and verification steps
- Reference existing code with full paths when relevant
- End with a verification command if applicable (e.g. `npm run build`, `npm test`)

---

## Phase 2 — Inject into Orchestrator

### Pre-Check — Does the Sprint Already Exist?

Before writing the file, check if a sprint with the same name already exists in the target repo:

```
mcp__agenthub-kanban__list_tasks(sprintName: "<sprint-name>", repoId: "<repo-uuid>")
```

**If tasks are returned:** the sprint name is taken. You have two options:
1. **Rename the sprint** — change `sprintName` to a new unique name (e.g. append `-v2`)
2. **Reset the old sprint** — invoke `/sprint-reset` (mode: `reset`) to clear the old run and archive the tasks, then re-use the name

**If the file already exists on disk** at the target path:
- Overwriting it is safe — the SprintWatcher re-reads on change
- But if the old file was already imported, the import will fail with: `"Sprint X already has tasks in this repo. Discard this import or rename the sprint before re-importing."`
- Always check via `list_tasks` first, not just the filesystem

### Path A — File Drop (recommended for full sprints)

Write the JSON file to the **target repo's sprint directory**:

```
<repo-path>/docs/sprints/<name>-sprint-intake.json
```

Filename must match the pattern `*-sprint-intake.json`. Examples:
- `auth-rewrite-sprint-intake.json`
- `2026-09-10-landing-page-sprint-intake.json`
- `codex-plugin-bridge-sprint-intake.json`

Create the `docs/sprints/` directory if it doesn't exist.

The SprintWatcher detects new files automatically. After detection, AgentHub either:
- Shows an import modal for user confirmation (default)
- Auto-imports if `autoConfirm: true`
- Auto-starts orchestrator if `autoStart: true` AND `autoConfirm: true`

### Path B — MCP create_task + dispatch_sprint (for programmatic/incremental use)

Create tasks one by one, then dispatch:

```
# Step 1 — Create each task
mcp__agenthub-kanban__create_task({
  repoId: "<repo-uuid>",
  title: "Task title",
  description: "Full instructions",
  priority: 1,
  category: "backend",
  sprintName: "PROJ-S1: Feature Name",
  skills: ["team-dev-loop"],
  modelOverride: "gemma4:31b-cloud",
  targetFiles: ["src/main/services/foo.ts"],
  requiresApproval: false
})

# Step 2 — After all tasks created, dispatch
mcp__agenthub-kanban__dispatch_sprint({
  sprintName: "PROJ-S1: Feature Name",
  repoId: "<repo-uuid>",
  confirmed: true,
  concurrencyCap: 3
})
```

Note: When using Path B with `skills` as an array, the array is correctly serialized to `skills_json` in the database. Both `skills: ["dev-backend"]` and `skillsJson: '["dev-backend"]'` work.

---

## Phase 3 — Validate Before Dispatch

Before dispatching, invoke `/sprint-to-orchestrator` for pre-flight validation:
- Sprint inventory check (Anamnesis)
- Blocker resolution check
- Code risk scan
- Dependency audit

This step is optional for test sprints but mandatory for production work.

---

## Full Example — Production Sprint

```json
{
  "sprintName": "PROJ-S2: Auth Middleware Rewrite",
  "repoId": "aff8e00e-7fe4-4ae0-ab4e-ef888c55e23e",
  "projectName": "my-project",
  "epics": [
    {
      "name": "Auth Middleware",
      "targetDate": "2026-09-15",
      "tasks": [
        {
          "localId": "AUTH-1",
          "title": "Write failing tests for new auth middleware",
          "description": "Create test file src/main/middleware/auth.test.ts with tests for:\n- Valid JWT token passes\n- Expired JWT returns 401\n- Missing Authorization header returns 401\n- Malformed token returns 400\n\nUse vitest. Import from ../auth (file does not exist yet — tests should fail).\nRun: npm test -- src/main/middleware/auth.test.ts\nExpected: all 4 tests FAIL (module not found).",
          "priority": 1,
          "category": "backend",
          "skills": ["dev-backend"],
          "modelOverride": "qwen3:8b",
          "targetFiles": ["src/main/middleware/auth.test.ts"],
          "requiresApproval": true,
          "dependsOn": []
        },
        {
          "localId": "AUTH-2",
          "title": "Implement auth middleware to pass tests",
          "description": "Create src/main/middleware/auth.ts implementing JWT validation middleware.\nAll 4 tests from AUTH-1 must pass.\nRun: npm test -- src/main/middleware/auth.test.ts\nExpected: 4/4 pass.",
          "priority": 1,
          "category": "backend",
          "skills": ["dev-backend"],
          "recommendedModel": "gemma4:31b-cloud",
          "targetFiles": ["src/main/middleware/auth.ts"],
          "requiresApproval": true,
          "dependsOn": ["AUTH-1"]
        },
        {
          "localId": "AUTH-3",
          "title": "Wire auth middleware into route handlers",
          "description": "Add auth middleware to all protected route handlers in src/main/ipc/.\nVerify full test suite passes: npm test",
          "priority": 2,
          "category": "backend",
          "skills": ["team-dev-loop"],
          "recommendedModel": "deepseek-v4-pro:0813:cloud",
          "targetFiles": ["src/main/ipc/"],
          "requiresApproval": true,
          "dependsOn": ["AUTH-2"]
        }
      ]
    }
  ]
}
```

---

## Constraints

- `sprintName` must be unique per repo — check with `list_tasks(sprintName)` before creating
- Max 50 epics, max 200 tasks per epic
- `localId` must be unique within the JSON file
- `dependsOn` references must point to valid `localId` values in the same JSON
- `priority` must be 1, 2, or 3 — no other values
- `providerOverride` must be one of: `ollama-local`, `ollama-cloud`, `anthropic`, `openai-codex`
- Never set `autoStart: true` without `autoConfirm: true`
- Always set `requiresApproval: true` on tasks touching DB migrations, IPC contracts, or security code

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using repo name instead of UUID for `repoId` | Get UUID from `get_context` or Settings > Repos |
| Empty `description` field | Description IS the agent prompt — be specific or the agent will hallucinate scope |
| Missing `dependsOn` chains | If task B needs task A's output, set `dependsOn: ["A-localId"]` |
| Setting `skills` as a string instead of array | Must be `["skill-name"]` not `"skill-name"` |
| Not setting `requiresApproval` on risky tasks | Orchestrator will auto-dispatch without human gate |
| Using deprecated model names | Check available models in AgentHub Settings > LLM before hardcoding |
| Circular `dependsOn` | Task A depends on B, B depends on A — orchestrator deadlocks |
| Dropping JSON to central intake instead of repo | Always use `<repo>/docs/sprints/` — keeps sprint files with the project |
| Overwriting a JSON file for an already-imported sprint | Check `list_tasks(sprintName)` first — import rejects duplicate sprint names. Use `/sprint-reset` or rename |

## Changelog

| Date | Change |
|---|---|
| 2026-09-10 | Initial version — covers schema, resolution chains, both injection paths |
