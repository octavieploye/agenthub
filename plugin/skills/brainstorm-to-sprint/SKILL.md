---
name: brainstorm-to-sprint
description: Post-brainstorm meta-orchestrator — chains sprint planning → dev loop → full-code-review gate. Review gate loops with dev-loop until all conflicts, assumptions, and long-term debt are resolved.
category: dev-skills
---

# Brainstorm to Sprint

Turns a brainstorm session output into a shipped, reviewed implementation. Chains three existing skills in sequence with a review gate loop that catches conflicts, assumptions, and long-term technical debt before commit.

## When to Use

- You just finished a brainstorm session (`/team-brainstorm`, `/team-tech-brainstorm`, or any ideation session) and want to go straight to implementation
- You have a Feature Brief, Idea Brief, or brainstorm output ready for sprint planning
- You want the full pipeline: plan → build → senior review → fix → re-review → commit

Do NOT invoke if:
- You only need sprint planning without implementation → use `/team-sprint-planner`
- You only need a dev loop without planning → use `/team-dev-loop`
- The brainstorm is still in progress — finish it first

## What You Need Before Starting

- **Input** — one of:
  - A brainstorm output file path (Feature Brief, Idea Brief, or session summary)
  - The brainstorm output from the current session (in conversation context)
- **Target repo** — full absolute path, confirmed by user
- **Scope** — what is included, what is excluded

## What This Skill Produces

1. **Sprint Plan** — from `team-sprint-planner` (written to `docs/sprints/`)
2. **Implementation** — from `team-dev-loop` (code changes, tests passing)
3. **Senior Review Report** — from the review gate (conflicts, assumptions, debt listed)
4. **Clean implementation** — all review issues resolved, ready for `git-ops`

---

## Orchestration Flow

```
PHASE 1: SPRINT PLANNING
  └─ team-sprint-planner
       Input: brainstorm output + repo path + scope
       Output: approved sprint plan
       Gate: user approves plan before proceeding

PHASE 2: DEV LOOP  ◄────────────────────────┐
  └─ team-dev-loop                           │
       Input: sprint plan                    │
       Output: implementation + tests pass   │
       Gate: dev-loop exits DONE             │
                                             │
PHASE 3: FULL CODE REVIEW GATE               │
  └─ full-code-review (chained mode)         │
       Input: all changes from Phase 2       │
       Output: Master Issue List             │
       Gate:                                 │
         CLEAN → EXIT DONE                   │
         ISSUES → back to Phase 2 ───────────┘
         MAX CYCLES (3) → EXIT ESCALATE
```

---

## Phase 1 — Sprint Planning

Invoke `/team-sprint-planner` with:
- The brainstorm output (file path or inline)
- Target repo path
- Scope definition

Wait for the sprint plan to be approved by the user. Do NOT proceed to Phase 2 until the user confirms the plan.

Print:
```
BRAINSTORM-TO-SPRINT — Phase 1: Sprint Planning
Input: {brainstorm source}
Target: {repo path}
```

---

## Phase 2 — Dev Loop

Invoke `/team-dev-loop` with:
- The approved sprint plan as the task description
- Scope from the sprint plan
- `MAX_ITER=5` (default)

Wait for dev-loop to exit DONE (all tests passing, frontend/backend wired).

If dev-loop exits STALL or MAX_ITER → escalate to user with the stall report. Do NOT proceed to Phase 3.

Print:
```
BRAINSTORM-TO-SPRINT — Phase 2: Dev Loop (cycle {N})
Sprint: {sprint name}
```

---

## Phase 3 — Full Code Review Gate

### State

```
review_cycle:     0        (increment at start of each review)
max_review_cycles: 3       (hard cap — escalate after this)
```

### Review Dispatch

Invoke `/full-code-review` in **chained mode**:

- Pass scope = all files changed during Phase 2 (exact file paths from dev-loop output)
- Pass repo path — already confirmed, do NOT re-ask
- `full-code-review` runs `architect`, `sr-backend`, and `sr-frontend` in parallel and returns a deduplicated **Master Issue List**
- Do NOT duplicate agent dispatch here — `full-code-review` owns that
- In chained mode, `full-code-review` skips the dependency scan if it was already run this session; otherwise it runs Phase 0 automatically

Receive the Master Issue List from `full-code-review`.

Print:
```
FULL CODE REVIEW — Cycle {N}/{max_review_cycles}
CRITICAL: {N}
HIGH:     {N}
MEDIUM:   {N}
LOW:      {N}
Total:    {N}
```

### Gate Decision

**CLEAN** — zero issues found:
```
→ EXIT DONE
```

**ISSUES** — issues found AND review_cycle < max_review_cycles:
```
→ Feed issues list to team-dev-loop as fix targets
→ Return to Phase 2
```

**MAX CYCLES** — review_cycle >= max_review_cycles AND issues remain:
```
→ EXIT ESCALATE — present remaining issues to user
```

---

## Exit: Done

```
BRAINSTORM-TO-SPRINT COMPLETE
Sprint Plan:     {sprint plan path}
Review Cycles:   {N}
Final State:     0 issues, all tests passing, senior review CLEAN
```

Ask the user: "Ready for `git-ops` to commit?"

---

## Exit: Escalate

```
BRAINSTORM-TO-SPRINT — REVIEW GATE EXHAUSTED
Review Cycles:   {max_review_cycles}
Remaining Issues: {count}
{list of unresolved items by severity}

These issues persisted across {N} review+fix cycles.
Options:
  A. Continue with additional review cycles (increase max)
  B. Accept remaining MEDIUM/LOW issues as known debt
  C. Pause and redesign the approach
```

STOP. Do not retry. Wait for user instruction.

---

## Constraints

- NEVER skip Phase 1 — no implementation without an approved sprint plan
- NEVER skip Phase 3 — no commit without full-code-review
- NEVER proceed to Phase 2 without user approval of the sprint plan
- NEVER exceed max_review_cycles without escalating
- NEVER commit — escalate to git-ops after user confirms Done
- `full-code-review` is READ-ONLY in Phase 3 — it does not fix code
- Fixes from review findings go through team-dev-loop, not direct edits
- CRITICAL findings in any review cycle block progression — must be resolved before next cycle
- Do NOT re-dispatch architect/sr-backend/sr-frontend manually — full-code-review owns that

## Common Mistakes

| Mistake | Fix |
|---|---|
| Starting dev-loop before sprint plan is user-approved | Phase 1 gate is mandatory — wait for explicit user confirmation |
| Manually dispatching architect/sr-backend/sr-frontend in Phase 3 | Invoke full-code-review in chained mode — it owns the 3-agent dispatch |
| Counting MEDIUM/LOW items as blockers on final cycle | Only CRITICAL/HIGH block — MEDIUM/LOW can be accepted as known debt on escalation |
| Feeding full Master Issue List as dev-loop input | Extract only actionable issue IDs — dev-loop needs fix targets, not the full report prose |
| Asking for scope or repo confirmation inside full-code-review | Chained mode — parent already confirmed both; full-code-review inherits scope |
