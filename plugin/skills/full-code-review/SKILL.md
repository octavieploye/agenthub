---
name: full-code-review
description: Full multi-agent codebase audit + fix + verify cycle. Use when the user says "run full code review", "full-code-review", or "/full-code-review"
category: dev-skills
---

# Full Code Review — 7-Phase Workflow

You are orchestrating a complete audit, fix, and verify cycle across the entire codebase. Follow all 7 phases in order. Never skip a phase. Each phase gates the next.

**Rules:**
- Never touch `_bmad/`, `_bmad-output/`, `.claude/`, `node_modules/`, or IDE config folders
- All issues must be ranked: CRITICAL → HIGH → MEDIUM → LOW
- Fix code, never tests — tests define expected behavior
- Parallel agents must never touch the same file

---

## Phase 1 — AUDIT

Dispatch three sub-agents **simultaneously**:

### audit-architect (Architect Reviewer)
Scope: Architecture, system design, cross-cutting concerns
Check for:
- Module boundaries, separation of concerns, circular dependencies
- Dead code: unreachable modules, unused exports, zombie features
- Hardcoded secrets or config values committed to version control
- Docker / infra / deployment correctness
- API contract consistency across layers
- Missing or broken wiring (routers not mounted, services not registered)
- Migration chain integrity and schema/model alignment

### audit-backend (Senior Backend Engineer)
Scope: All backend source files (services, repositories, models, routes, migrations, tests)
Check for:
- Silent bugs: wrong field used, off-by-one, incorrect status strings
- Blocking calls in async contexts
- DB session lifecycle errors (SSE generators, background tasks)
- Raw DB access bypassing service layer
- Missing null guards
- Soft-delete violations (hard DELETE instead of archive/status update)
- Test coverage gaps and incorrect assertions
- Swallowed exceptions, missing HTTP status codes
- Security: injection risks, missing input validation, auth gaps

### audit-frontend (Senior Frontend Engineer)
Scope: All frontend source files (components, stores, hooks, workers, routing, assets)
Check for:
- API calls that fire at module scope (before framework mounts)
- React anti-patterns: key={index}, missing useEffect cleanup, stale closures
- Layout bugs: incorrect height/overflow constraints
- Web Worker: non-idempotent setInterval, missing stop before terminate
- DOM/cursor mutations without cleanup
- Dead UI: components never rendered, hidden features with broken wiring
- TypeScript errors (strict violations, any casts)
- Hardcoded env/test flags committed to main
- Broken asset imports

Collect all three outputs. Merge into a single deduplicated master issue list with severity and file:line. Record counts by severity.

---

## Phase 2 — PLAN

Group all issues into three non-overlapping workstreams (no two workstreams touch the same file):
- **Workstream A** — Critical architecture and infrastructure fixes
- **Workstream B** — Backend services, repositories, migrations
- **Workstream C** — Frontend components, stores, hooks, workers

Any issue touching files across multiple workstreams → mark as **sequential** (handled by cleanup agent after parallel fix phase).

Write the plan to `_bmad-output/full-code-review-{date}.md`.

---

## Phase 3 — FIX

Dispatch three fix agents **simultaneously**, one per workstream:

- **fix-backend-critical** → Workstream A files only
- **fix-backend-services** → Workstream B files only
- **fix-frontend** → Workstream C files only

Each agent: fix every issue in their workstream. Minimal, targeted changes only. Do not touch other workstreams' files. If a fix surfaces a new cross-workstream issue, add it to the sequential list — do not fix it unilaterally.

---

## Phase 4 — CLEANUP

Single agent handles all cross-cutting work:
1. Record pre-fix test baseline (passing / failing counts)
2. Resolve any cross-agent conflicts (duplicate routes, double imports, conflicting changes)
3. Fix all sequential issues from the plan
4. Fix any tests broken by the parallel agents (fix the code, not the assertion)
5. Record post-fix test baseline — confirm no regression vs pre-fix

---

## Phase 5 — VERIFY

Dispatch three review agents **simultaneously** (same domains as Phase 1):

- **review-architect** — verify all CRITICAL + HIGH architecture issues from Phase 1
- **review-backend** — verify all CRITICAL + HIGH backend issues from Phase 1
- **review-frontend** — verify all CRITICAL + HIGH frontend issues from Phase 1; confirm 0 new TypeScript errors

Each agent reports: RESOLVED / PARTIAL / STILL PRESENT / NEW ISSUE for every item they own.

Compile all PARTIAL / STILL PRESENT / NEW ISSUE findings into a remaining issues list.

---

## Phase 6 — POST-REVIEW FIXES

If remaining issues exist: fix them all. Run the test suite one final time and confirm no regressions.

If no remaining issues: skip this phase.

---

## Phase 7 — LOG

Write the full final report to `_bmad-output/full-code-review-{date}.md`:
- All issues found (severity, file:line)
- All fixes applied (what changed and why)
- Deferred items (intentionally not fixed, with reason)
- Final test baseline
- Any new architectural invariants discovered

If a project memory or log file exists, append a one-paragraph summary entry.

Present the final summary table to the user:

| | Count |
|---|---|
| Issues found | — |
| Issues fixed | — |
| Deferred | — |
| Tests passing (final) | — |
| Tests failing (final) | — |
