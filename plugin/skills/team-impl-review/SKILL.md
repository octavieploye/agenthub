---
name: team-impl-review
description: Implementation Review Team Orchestrator — post-sprint audit: plan vs git vs code vs integration. Codebase is ground truth. DONE/PARTIAL/MISSING/CONFLICT verdicts with file:line evidence. Loops with team-dev-loop for fixes.
category: dev-skills
---

# Implementation Review Team

Post-sprint audit that verifies whether planned work was actually implemented correctly. Cross-references the implementation plan against git commits, source code, and integration wiring. Produces a structured report with evidence for every claim.

## When to Use

- After a sprint or implementation plan has been executed — verify completeness
- Before marking a sprint as "done" — audit actual state vs plan
- When returning to a project after a gap — verify what was actually built
- When a scout or agent reports status that seems wrong — countercheck with evidence
- Before starting a new sprint that depends on a previous one — verify prerequisites

## What You Need Before Starting

- Path to the implementation plan / sprint doc
- Target repo path (confirmed by user — CWD is not confirmation)
- Date range for git review (optional — defaults to plan creation date to now)
- Scope: full audit (all tasks in plan) or specific tasks only

## What This Team Produces

- **Implementation Review Report** with per-task verdicts:
  - DONE — fully implemented, matches spec (evidence: file:line + git hash)
  - PARTIAL — file exists but incomplete or spec mismatch (evidence: what's missing)
  - MISSING — file/feature does not exist (evidence: grep showing no results)
  - CONFLICT — implementation contradicts the spec (evidence: file:line + spec ref)
- **Discrepancy list** formatted as team-dev-loop intake (ready for automated fixes)
- **Confidence score** per item: verified (file read) vs inferred (git log only)

## PRIME DIRECTIVE — CODEBASE IS GROUND TRUTH

This team exists because of a specific failure mode: agents reading plan documents and inferring implementation status from them. A plan saying "X must be done before Y" does NOT mean X hasn't been done. A plan saying "create file Z" does NOT mean Z doesn't exist.

**Rules that prevent this failure:**
1. Every claim must have a file path + line number as evidence
2. Plan documents are INPUT (what to check), not STATUS (what is done)
3. If a reviewer reports without evidence, the lead rejects the report
4. Git commits prove something was committed, not that it's correct
5. Only reading the actual file proves what the file contains

## Agent Sequence

1. **impl-review-lead** — Phase 0: Reads plan, extracts task checklist, confirms repo with user
2. **impl-review-git** — Phase 1: Maps git commits to planned tasks, identifies gaps and prerequisite commits
3. **impl-review-code** + **impl-review-integration** — Phase 2 (parallel): Code reviewer verifies source files match spec; Integration reviewer verifies wiring, imports, routes, migrations, env vars, dependencies
4. **impl-review-lead** — Phase 3: Aggregates all reports, assigns per-task verdicts, produces final report
5. **impl-review-lead** — Phase 4 (loop): If discrepancies found, presents to user. On approval, feeds to team-dev-loop for fixes, then re-runs Phase 2-3 as verification pass. Loops until all items are DONE or explicitly deferred.

## Key Rules

- **Max 3 active agents** at any time. Lead manages concurrency.
- **Evidence-based only**: No "appears to", "seems like", "probably". Either it matches or it doesn't.
- **Read-only during review**: No file modifications, no commits during Phases 0-3. Fixes happen via team-dev-loop in Phase 4.
- **Repo gate**: Lead must confirm target repo with user before dispatching any reviewer.
- **Cross-plan awareness**: If the plan references sibling plans (prerequisites, shared modules), the lead reads those too.
- **Never trust commit messages alone**: A commit message saying "add feature X" does not prove X works. The code reviewer must verify.

## How to Invoke

Tell the lead what to review. Examples:
- "review if the anti-fraud sprint is complete" → full audit against sprint plan
- "verify Sprint 3 service layer was implemented" → scoped to Sprint 3 tasks
- "check if Clerk removal is actually done" → targeted prerequisite check
- "audit opeidos before starting Sprint 4" → verify Sprint 2-3 prerequisites
- "re-verify after dev-loop fixes" → Phase 2-3 re-run only (skip git review)

## Loop Mechanism

```
Plan doc → impl-review-team (audit) → Report
                                         |
                                    discrepancies?
                                    /           \
                                  NO             YES
                                  |               |
                              All DONE      Present to user
                                              |
                                         User approves?
                                         /          \
                                       YES          DEFER
                                        |             |
                                  team-dev-loop    Mark deferred
                                        |
                                  impl-review-team (re-audit)
                                        |
                                    (loop until clean)
```
