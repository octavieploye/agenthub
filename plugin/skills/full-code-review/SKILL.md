---
name: full-code-review
description: Full multi-agent codebase review — architect + sr-backend + sr-frontend audit in parallel. Review-only, no fixes. Produces deduplicated master issue list (CRITICAL/HIGH/MEDIUM/LOW) with file:line evidence and issue category. Scope-aware — inherits scope from parent orchestrator or asks user in standalone mode.
category: dev-skills
---

# Full Code Review — Review-Only Audit

You are orchestrating a review-only audit using three named agents: `architect`, `sr-backend`, and `sr-frontend`. You produce a findings report. You do NOT fix anything — that is `team-dev-loop`'s job.

## When to Use

- User says "run full code review", "full-code-review", or "/full-code-review"
- Chained by `team-dev-loop`, `team-frontend`, `team-backend-hardening`, or any parent orchestrator that provides scope
- Before a production deployment to verify code quality
- After a major refactor to check for regressions
- Periodic health check on a module or feature area

## Scope Detection — Two Modes

**Check on entry:** Was a scope provided in the invocation (file paths, directories, module names, brief, or sprint scope)?

### Chained Mode (scope provided)

When spawned by a parent orchestrator (`team-dev-loop`, `team-frontend`, `team-backend-hardening`, or any skill that passes scope):

- Inherit the scope exactly as given — do NOT expand it
- Do NOT ask for repo confirmation — the parent already confirmed
- Do NOT ask for scope confirmation — the parent defines the boundary
- Agents review ONLY the files/directories within the provided scope
- If scope is a sprint or brief: extract the file paths and modules from it, review only those

### Standalone Mode (no scope provided)

When invoked directly by the user without a parent orchestrator:

- **STOP and ask:** "Which files, directories, or modules should I review? (say 'full repo' to review everything)"
- **STOP and confirm repo** if not already confirmed this session
- Do NOT default to full repo — full repo only when user explicitly says "full repo", "everything", or "entire codebase"
- Once scope is confirmed, proceed to Phase 0

**Scope format examples the user might give:**
```
"review src/main/services/"
"review the kanban widget"
"review src/renderer/src/widgets/kanban/ and src/main/services/kanban-service.ts"
"full repo"
```

---

## Phase 0 — DEPENDENCY SECURITY SCAN (blocks if findings exist)

Run before dispatching any audit agents:

```bash
npm audit --json
```

Classify findings:

| Severity | Action |
|---|---|
| CRITICAL | **HARD STOP** — surface immediately. Phase 1 does NOT begin until user acknowledges each one |
| HIGH | **HARD STOP** — surface immediately. Phase 1 does NOT begin until user acknowledges each one |
| MODERATE | Surface as warning, audit continues |
| LOW | Log only, audit continues |

Also check `package.json` for:
- Deprecated packages (flag with replacement + upgrade guide)
- Pinned versions behind their patched equivalent

Output format per finding:
```
[CRITICAL] {package}@{current} — {CVE or reason} — patched in: {safe_version}
```

If CRITICAL/HIGH found, print:
```
DEPENDENCY SCAN — BLOCKED
{list of findings}

Options:
  A. Upgrade affected packages now (update package.json + npm install)
  B. Accept-risk with sign-off (user states reason, logged in final report)
  C. Abort review
```

Wait for explicit user instruction before proceeding to Phase 1.

If scan is clean:
```
DEPENDENCY SCAN — CLEAN
```

**In chained mode:** if the parent orchestrator already ran a dependency scan in this session, skip Phase 0 and note `DEPENDENCY SCAN — SKIPPED (parent scan)`.

---

## Phase 1 — AUDIT (3 agents in parallel)

Dispatch three named agents **simultaneously**, scoped to the files/directories defined in scope detection:

### `architect`
Domain: Architecture, system design, cross-cutting concerns
**Within scope**, check for:

**Conflicts:**
- Cross-layer type mismatches between shared types and their consumers
- IPC contract violations (channel names, payload shapes, direction mismatches)
- Circular dependencies between modules
- Service registration mismatches (service exists but not wired in orchestrator)

**Mismatches:**
- API contract inconsistency across layers (types say X, handler sends Y)
- Migration chain vs model/schema alignment drift
- Missing or broken wiring (routers not mounted, services not registered, IPC not exposed)

**Long-term debt:**
- Dead code: unreachable modules, unused exports, zombie features
- Files approaching 1000 lines (extraction candidates per project rule)
- Module boundary violations, separation of concerns issues

**Security:**
- Hardcoded secrets or config values committed to version control
- Docker / infra / deployment misconfigurations

### `sr-backend`
Domain: Backend source files (services, repositories, models, routes, migrations, tests)
**Within scope**, check for:

**Silent failures:**
- Swallowed exceptions (empty catch blocks, catch-and-continue without logging)
- Missing error propagation (error occurs but caller never knows)
- Missing HTTP status codes or wrong status codes
- Missing null guards on values that can be undefined

**Hidden errors:**
- Wrong field name used (e.g., `user.name` when schema has `user.displayName`)
- Off-by-one errors in loops, pagination, or array access
- Incorrect status strings (not matching UNIVERSAL-STANDARDS vocabulary)
- Stale references to renamed/removed functions or modules

**Conflicts:**
- Blocking calls in async contexts
- DB session lifecycle errors (connections not released, transactions not committed)
- Raw DB access bypassing service layer

**Long-term debt:**
- Soft-delete violations (hard DELETE instead of archive/status update)
- Test coverage gaps and incorrect assertions
- Nesting deeper than level 2 (extraction candidates)
- Duplicated logic across services

**Security:**
- SQL/NoSQL injection risks
- Missing input validation on handler parameters
- Auth gaps (unprotected routes, missing permission checks)

### `sr-frontend`
Domain: Frontend source files (components, stores, hooks, workers, routing, assets)
**Within scope**, check for:

**Silent failures:**
- API calls that fire at module scope (before framework mounts)
- Missing useEffect cleanup (subscriptions, timers, listeners left dangling)
- Stale closures capturing outdated state
- Web Worker: non-idempotent setInterval, missing stop before terminate

**Hidden errors:**
- DOM/cursor mutations without cleanup
- Broken asset imports (referencing files that don't exist)
- Hardcoded env/test flags committed to main

**Mismatches:**
- Component props not matching the types they declare
- Zustand store shape drift from IPC response shapes
- IPC channel usage not matching constants in `ipc-channels.ts`

**Long-term debt:**
- Dead UI: components never rendered, hidden features with broken wiring
- TypeScript errors (strict violations, `any` casts, missing return types)
- React anti-patterns: `key={index}`, prop drilling beyond 2 levels
- Layout bugs: incorrect height/overflow constraints
- Components exceeding 300 lines (split candidates)
- Duplicated UI logic across components

**Security:**
- XSS vectors (dangerouslySetInnerHTML, unsanitized user input rendered)
- Sensitive data exposed in renderer logs or DOM

---

## Phase 2 — MERGE & REPORT

Collect all three agent outputs. Produce a single deduplicated **Master Issue List**.

**Deduplication rules:**
- If two agents flag the same file:line, keep the higher severity and merge descriptions
- If the same root cause produces symptoms in multiple layers, consolidate into one cross-layer finding at the highest severity

**Output format — Master Issue List:**

```
FULL CODE REVIEW — {scope description}
Date: {timestamp}
Agents: architect, sr-backend, sr-frontend
Scope: {files/directories reviewed}

SUMMARY
  CRITICAL: {N}
  HIGH:     {N}
  MEDIUM:   {N}
  LOW:      {N}
  Total:    {N}

FINDINGS

| ID | Severity | Category | Description | File:Line | Agent |
|---|---|---|---|---|---|
| R-001 | CRITICAL | silent-failure | Swallowed exception in ... | src/main/services/foo.ts:42 | sr-backend |
| R-002 | HIGH | mismatch | IPC payload shape differs from ... | src/shared/types/bar.ts:15 | architect |
| R-003 | MEDIUM | long-term-debt | File approaching 1000 lines | src/renderer/src/App.tsx:1 | sr-frontend |
| ... | ... | ... | ... | ... | ... |
```

**Issue categories (use exactly these in the Category column):**
- `conflict` — cross-layer, type, IPC, circular dependency
- `silent-failure` — swallowed exception, missing error propagation, empty catch
- `hidden-error` — wrong field, off-by-one, incorrect string, stale reference
- `mismatch` — API/type/schema drift, contract divergence
- `long-term-debt` — code smell, oversized file, deep nesting, duplication
- `security` — injection, missing validation, auth gap, exposed secret

**No action plan. No fix suggestions.** The report is the deliverable. Fixing is `team-dev-loop`'s job. Each agent's review IS the senior assessment — they flag what they find, that's the output.

---

## Rules

- **Review-only** — no code changes, no file writes (except the report if standalone mode)
- Never touch `.claude/`, `node_modules/`, or IDE config folders
- Every finding MUST have file:line evidence — no vague warnings
- Never review files outside the defined scope — even if you notice issues in adjacent files, they are out of scope (note them as "out-of-scope observation" at the bottom of the report, max 3)
- All three agents must complete before Phase 2 begins
- If an agent finds 0 issues in its domain: report `{agent}: 0 issues — clean` (do not invent findings to look thorough)
- **In chained mode:** return the Master Issue List to the parent orchestrator. Do not present it to the user — the parent handles presentation.
- **In standalone mode:** present the Master Issue List to the user. Ask: "Hand off to `team-dev-loop` for fixes? (yes / no / select specific IDs)"

## Constraints

- Max 3 agents active at once (Phase 1 dispatches exactly 3 — within limit)
- Agents use their existing command definitions — do not override their instructions
- `architect` uses: `Read`, `Glob`, `Grep`
- `sr-backend` uses: `Read`, `Glob`, `Grep`
- `sr-frontend` uses: `Read`, `Glob`, `Grep`
- All three are read-only — if any agent attempts a write, that is a skill violation

## Common Mistakes

| Mistake | Fix |
|---|---|
| Reviewing the full repo when scope was provided | STOP — re-read scope. Only review what was specified. |
| Asking for scope confirmation in chained mode | The parent already confirmed scope. Trust it. |
| Defaulting to full repo in standalone mode | Never default. Ask the user. |
| Including fix suggestions in the report | No fixes. Report findings only. Fixing is team-dev-loop's job. |
| Skipping Phase 0 in standalone mode | Phase 0 is mandatory in standalone. Only skip when parent already ran it. |
| Inventing findings when a domain is clean | Report 0 issues. Clean is a valid result. |
| Reviewing adjacent files outside scope | Out of scope. Note max 3 observations at the bottom, never as findings. |
| Using anonymous sub-agents instead of named agents | Always use `architect`, `sr-backend`, `sr-frontend` — the named, versioned agents. |
