---
name: team-dev-loop
description: Agentic coding loop — iterates review → fix → test until frontend and backend are fully wired and all tests pass. Stall detection after 2 identical-error iterations. Configurable max iterations (default 5).
category: dev-skills
---

# Dev Loop — Iterate Until Done

An agentic build loop that runs until the task is complete: all tests pass and frontend/backend are wired end-to-end. Each iteration reviews first, fixes second, tests third. The loop exits on success, escalates on stall or max-iterations.

## When to Use

- User says "run dev loop", "loop until done", "/team-dev-loop", or "keep coding until it works"
- A feature is partially built and needs to be driven to completion
- Multiple wiring issues exist across frontend, backend, and integration layers
- You want review-gated development (no blind coding without a review checkpoint)

## What You Need Before Starting

- A clear task description (what feature/fix needs to reach "done")
- Optionally: `MAX_ITER=N` (default 5) and the scope (which files/modules)
- The existing test suite must be runnable via `npm test`
- Active `dev-stack` team session or sufficient agent slots

## Loop State — Track These Each Iteration

```
MAX_ITER:    5        (override with user-provided value)
iter:        0        (counter — increment at top of every loop)
issues_prev: []       (fingerprint of last iteration's issues list)
stall_count: 0        (increments when issues_prev == issues_current)
```

---

## Loop Workflow

### INIT

Set MAX_ITER (from user or default 5). Set iter=0, issues_prev=[], stall_count=0.

Print loop header:
```
DEV LOOP — Task: {task description}
MAX_ITER: {N}  |  Started: {timestamp}
```

---

### STEP 0 — DEPENDENCY SECURITY SCAN (runs once, before iteration 1)

Run immediately after INIT, before any review or code:

```bash
npm audit --json
```

Parse output and classify findings:

| Severity | Action |
|---|---|
| CRITICAL | **HARD STOP** — surface immediately. Loop does NOT proceed until user explicitly acknowledges each one |
| HIGH | **HARD STOP** — surface immediately. Loop does NOT proceed until user explicitly acknowledges each one |
| MODERATE | Surface as warning, loop may proceed — user decides |
| LOW | Log, loop proceeds |

Also scan `package.json` for deprecated packages:
- Run `npm outdated` or check `npm audit` output for deprecation notices
- Deprecated packages: surface as HIGH with the replacement package name and upgrade guide URL

**Output format for each CRITICAL/HIGH finding:**
```
[CRITICAL] {package}@{current} — {CVE or reason}
  Patched in: {safe_version}
  Action required: upgrade or confirm accepted-risk before loop proceeds
```

**Gate rule:** If ANY CRITICAL or HIGH finding exists, print:
```
DEPENDENCY SCAN — BLOCKED
{list of findings}

Loop is paused. Options:
  A. Upgrade affected packages (agent will update package.json + run npm install)
  B. Accept-risk with sign-off (user states reason, loop proceeds with warning logged)
  C. Abort loop
```

Wait for explicit user instruction. Do NOT proceed to iteration 1 until the gate clears.

If scan is clean:
```
DEPENDENCY SCAN — CLEAN (no CRITICAL/HIGH)
```
Proceed to ITERATION START.

---

### ITERATION START

Increment `iter`. Print:
```
--- ITERATION {iter}/{MAX_ITER} ---
```

---

### STEP 1 — REVIEW (run 3 sub-agents in parallel)

Dispatch simultaneously:

**review-backend** (uses `dev-backend` role)
- Read all backend source files in scope
- Check: missing null guards, wrong field names, broken async, missing service registrations, DB schema/model drift, IPC handler gaps, migration issues
- Also read `package.json`: flag any newly added packages that are deprecated or have known CVEs (compare against `npm audit` output if available)
- Output: list of issues with severity (CRITICAL/HIGH/MEDIUM/LOW) and file:line

**review-frontend** (uses `dev-frontend` role)
- Read all frontend source files in scope
- Check: API calls at module scope, missing useEffect cleanup, stale closures, TypeScript errors, broken store connections, dead UI components, missing IPC listeners
- Output: list of issues with severity and file:line

**review-integration** (uses `scout-integration` role)
- Verify all cross-layer contracts: IPC channels match, API payloads match types, Zustand store keys match IPC response shapes, error handling present end-to-end
- Output: list of wiring issues with severity and file:line

Merge all three outputs into a single deduplicated master issues list, sorted by severity.

Print:
```
REVIEW COMPLETE — {N} issues found (CRITICAL:{n} HIGH:{n} MEDIUM:{n} LOW:{n})
```

---

### STEP 2 — EXIT CHECK

Run this check before any fixes:

**Check A — DONE:**
```
if master_issues_list is empty:
  run: npm test
  if all tests pass:
    → EXIT DONE (see Exit: Done below)
  else:
    → treat test failures as new issues, add to master list, continue loop
```

**Check B — STALL:**
```
Compare master_issues_list fingerprint with issues_prev.
If identical or a strict subset of issues_prev:
  stall_count++
else:
  stall_count = 0

issues_prev = master_issues_list fingerprint

if stall_count >= 2:
  → EXIT STALL (see Exit: Escalate below)
```

**Check C — MAX ITERATIONS:**
```
if iter >= MAX_ITER:
  → EXIT MAX (see Exit: Escalate below)
```

---

### STEP 3 — FIX (run in parallel where no file collision)

Group issues into non-overlapping workstreams:
- **Workstream B** — backend files only (IPC handlers, services, DB, migrations)
- **Workstream F** — frontend files only (components, stores, hooks, workers)
- **Workstream I** — cross-layer wiring (shared types, IPC channel constants, contract fixes)

If an issue touches files in multiple workstreams → mark as sequential, fix after parallel agents complete.

Dispatch simultaneously:

**fix-backend** (uses `dev-backend` role)
- Fix every issue in Workstream B
- Minimal targeted changes only — do not touch frontend files
- If a fix uncovers a new cross-workstream issue → add to sequential list, do not fix unilaterally

**fix-frontend** (uses `dev-frontend` role)
- Fix every issue in Workstream F
- Minimal targeted changes only — do not touch backend files

After parallel agents complete:

**fix-integration** (uses `dev-integration` role, sequential)
- Fix all Workstream I issues
- Resolve any conflicts introduced by parallel agents (duplicate imports, conflicting types)
- Fix all sequential cross-workstream issues

Print:
```
FIX COMPLETE — {N} issues addressed
```

---

### STEP 4 — TEST

Run: `npm test`

Record:
```
Tests passing: {N}
Tests failing: {N}
```

Rules:
- NEVER change a test to make it pass — fix the code
- If a test fails and the fix requires understanding the original contract, read the test first
- If the same test keeps failing across 2+ iterations → flag it as a stall signal

Print result:
```
TESTS — Pass:{N} Fail:{N}
```

---

### LOOP BACK

goto ITERATION START

---

## Exit: Done

Run final dependency scan before handoff:
```bash
npm audit --json
```
If NEW CRITICAL/HIGH findings appear (introduced by packages added during fixes): surface them now, do NOT hand off to git-ops until resolved.

Print:
```
DEV LOOP COMPLETE
Iterations: {iter}
Final state: 0 issues, all tests passing
Frontend/backend wired: CONFIRMED
Dependency scan: CLEAN / {N findings — see above}
```

Produce a summary of all changes made across iterations (grouped by iteration).

Ask the user: "Ready for `git-ops` to commit?"

---

## Exit: Escalate

**STALL** — same errors appeared in 2+ consecutive iterations:
```
DEV LOOP STALLED — Iteration {iter}
Stalled on:
{list of repeating issues}

Hypothesis: {root cause guess — wrong approach, missing dependency, architectural conflict}
Options:
  A. {suggested fix strategy}
  B. {alternative approach}
  C. Pause and let user decide
```

**MAX ITERATIONS** reached:
```
DEV LOOP — MAX ITERATIONS REACHED ({MAX_ITER})
Remaining issues: {N}
{list of unresolved issues by severity}

Recommended next step: {analysis of why they remain}
```

In both cases: STOP. Do not retry. Present the stall report to the user and wait for instruction.

---

## Constraints

- NEVER change tests to make them pass — fix the code, not the assertion
- NEVER fix an issue in the wrong workstream — parallel agents must respect file boundaries
- NEVER skip the REVIEW step — no coding iteration without a prior review
- NEVER exceed MAX_ITER without escalating
- NEVER commit — escalate to git-ops after user confirms Done
- After 3 failed attempts to fix the same issue across iterations → add it to the stall report immediately, do not keep retrying

## Common Mistakes

| Mistake | Fix |
|---|---|
| Coding before reviewing on iteration 1 | Always run STEP 1 first, even on a fresh task — review the initial state |
| Fixing test assertions to clear the test suite | Fix the source code; the test defines the contract |
| Both fix-backend and fix-frontend touching a shared types file | Move shared type issues to Workstream I (fix-integration) |
| Counting stall when new issues were introduced | Stall only fires when current issues = subset of previous; new issues reset stall_count |
| Continuing past MAX_ITER | Hard stop — escalate to user with remaining issue list |
| Skipping STEP 0 on first run | STEP 0 is mandatory — no iteration begins without a clean or acknowledged dependency scan |
| Proceeding past a CRITICAL/HIGH npm audit finding | Hard stop — user must explicitly acknowledge every CRITICAL/HIGH before loop resumes |
| Not re-running audit at Exit: Done | A fix package could introduce new vulns — always re-audit before git-ops handoff |
