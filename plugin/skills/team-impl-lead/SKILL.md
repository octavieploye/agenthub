---
name: team-impl-lead
description: Implementation Lead Team Orchestrator — scope-aware project audit with 3 modes (light/dev/full). Produces discovery report + implementation plan. Scope-aware — inherits from parent or asks user. Light mode for small tasks skips scouts entirely.
category: dev-skills
---

# Team Implementation Lead

Project audit and implementation planning. Adapts to task size: light mode for small tasks, dev mode for features, full mode for new projects.

## When to Use

- Starting a new project or returning after a gap → `full` mode
- Building a feature or refactoring a module → `dev` mode
- Small bug fix or 2-5 file change → `light` mode
- Chained by `brainstorm-to-sprint` or other parent orchestrator → inherits scope

## Scope Detection — Three Modes

**Check on entry:** Was scope provided? How large is the task?

### Chained Mode (scope provided by parent)

When spawned by a parent orchestrator (`brainstorm-to-sprint`, `team-sprint-planner`, or any skill that passes a brief/sprint/scope):

- Inherit the scope exactly as given — do NOT expand it
- Do NOT run intake (Phase 1) — the parent already defined the task
- Do NOT ask for repo confirmation — the parent already confirmed
- Skip directly to the appropriate phase based on scope size

### Standalone Mode (direct user invocation)

Run Phase 1 intake. Determine mode from what the user asked:

| User says | Mode | What runs |
|---|---|---|
| "audit from scratch", "what exists vs missing", "full audit" | `full` | All scouts + planner |
| "map the stack", "stack only" | `stack-only` | `impl-scout-stack` only + planner |
| "map the product", "product only" | `product-only` | `impl-scout-product` only + planner |
| "build feature X", "implement this brief", multi-file feature | `dev` | `impl-scout-stack` + `impl-scout-product` + planner |
| "fix this bug", "small change", < 5 files, "light" | `light` | No scouts — impl-lead reads files directly |

If mode is ambiguous, ask: "This looks like a {mode} task — confirm? (light / dev / full)"

---

## Light Mode (< 5 files or user says "light")

For small tasks that don't need scouts or output files:

1. impl-lead reads the relevant files directly (max 5 files)
2. Confirms scope with user: "I'll touch these files: {list}. Correct?"
3. Produces a 1-paragraph inline plan — no output files written
4. Done — hand off to `team-dev-loop` or direct coding

**No scouts. No planner. No output files. No Phase 0.**

---

## Phase 1 — INTAKE (standalone mode only)

impl-lead asks:
- Project name or identifier
- Root directory or repo path (confirm with user)
- Task description — what needs to be built or checked
- Any existing spec, brief, or feature list

From the answers, impl-lead determines:
- **Mode**: light / stack-only / product-only / dev / full
- **Project type**: `commercial` or `internal` (affects impl-scout-content scope)
- **Scope**: which files/directories/modules are in play

If mode is `light`: skip to Light Mode above.
Otherwise: proceed to Phase 2.

---

## Phase 2 — DISCOVERY (scouts + stack gate in parallel)

### Stack Research Gate (runs in parallel with scouts)

For every package, framework, and service in the current or proposed tech stack:

1. **WebSearch current stable version** — `npm view {package} dist-tags` or equivalent
2. **Check deprecation** — is the package deprecated?
3. **Check peer dependencies** — compatible across the stack?
4. **Check security advisories** — known CRITICAL/HIGH CVEs?
5. **Produce compatibility matrix:**

```
| Package | Latest Stable | Version In Use | Compatible With | Status |
|---|---|---|---|---|
| ... | x.y.z | x.y.z | ... | APPROVED / FLAGGED |
```

**Gate rules:**
- Deprecated → STOP, identify replacement
- CRITICAL/HIGH CVE → STOP, identify patched version
- Incompatible peer deps → STOP, resolve before proceeding
- More than 1 major behind → justify or upgrade

### Scout Dispatch (mode-dependent, in parallel with stack gate)

| Mode | Scouts dispatched | Max agents |
|---|---|---|
| `stack-only` | `impl-scout-stack` | 1 scout + stack gate = 2 |
| `product-only` | `impl-scout-product` | 1 scout + stack gate = 2 |
| `dev` | `impl-scout-stack` + `impl-scout-product` | 2 scouts + stack gate = 3 |
| `full` | `impl-scout-stack` + `impl-scout-product` + `impl-scout-content` | 3 scouts (stack gate runs as part of impl-lead, not a separate agent) |

**impl-scout-content receives a project-type parameter:**
- `commercial` → full 8-section scan (marketing, legal, MoR, company status, content strategy)
- `internal` → sections 4 (Project Documentation) + 5 (Compliance Signals) only

impl-lead determines project-type during Phase 1 intake. Default: `internal` for AgentHub/Anamnesis/Hermes repos, `commercial` for Hephaestus/Opeidos repos.

**Wait for all dispatched agents to complete before Phase 3.**

---

## Phase 3 — PLAN & PRESENT

Dispatch `impl-planner` with all completed scout maps.

impl-planner performs (per its existing command definition):
1. **Cross-Map Reconciliation** — flags contradictions, overlaps, cascade gaps between scout maps
2. **Implementation Plan** — prioritized table (P0/P1/P2) of what needs to be built
3. **Conformance Check** — what exists vs what's expected (CONFORMANT / NON-CONFORMANT / MISSING / UNKNOWN)
4. **Open Items** — questions, suggestions, risks

impl-planner returns two documents:
- `implementation-plan.md` — plan + conformance + open items (all in one)
- `discovery-report.md` — merged scout maps

impl-lead presents both to the user. **No files written until user approves.**

If user approves: write to `docs/impl-lead/{project-slug}/`:
- `discovery-report.md`
- `implementation-plan.md`

If user requests changes: revise the plan inline, re-present.

---

## What This Team Produces

- `docs/impl-lead/{project-slug}/discovery-report.md` — everything found, organized by dimension
- `docs/impl-lead/{project-slug}/implementation-plan.md` — prioritized build list + conformance check + open questions

In light mode: inline plan only, no files.

## Key Rules

- impl-lead runs intake in standalone mode only — chained mode skips it
- Scouts only run in dev/full/stack-only/product-only modes — never in light mode
- impl-planner does NOT run until all dispatched scouts are complete
- This team is read-only during discovery — no file changes, no commits
- All outputs shown to user for review before any files are written to disk
- STOP AND ASK if: project path is ambiguous, a spec contradicts the code, scope is unclear, or scouts return contradictory findings
- Max 3 agents active at once (respected across all modes)
- Stack gate findings that are FLAGGED must be resolved before impl-planner runs

## Common Mistakes

| Mistake | Fix |
|---|---|
| Running full mode for a 2-file bug fix | Use light mode — no scouts, inline plan only |
| Running intake when parent provided scope | Chained mode — inherit scope, skip intake |
| Dispatching all 3 scouts for a dev task | Dev mode uses stack + product only, no content |
| Running stack gate before knowing the stack | Stack gate runs in parallel with scouts, after intake |
| Writing output files before user approval | Always present first, write only after explicit approval |
| Running impl-scout-content with full 8 sections on an internal repo | Pass `project-type: internal` — only docs + compliance |
| Producing 4 separate output files | 2 files only: discovery-report + implementation-plan |
| impl-lead reviewing scout maps separately from impl-planner | impl-planner does the reconciliation — impl-lead presents the result |

## How to Invoke

Examples:
- "audit opeidos from scratch" → full mode, standalone, commercial
- "map the stack for agenthub" → stack-only mode, standalone, internal
- "build the notification feature" → dev mode, standalone
- "fix the kanban card color bug" → light mode, standalone
- (chained by brainstorm-to-sprint with brief) → inherits scope, skips intake
