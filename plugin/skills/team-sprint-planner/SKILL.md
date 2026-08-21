---
name: team-sprint-planner
description: Sprint Planner Team Orchestrator — intake to approved sprint plan with full ownership matrix, TDD gates, orchestration validation
category: dev-skills
---

# Team Sprint Planner

Structured sprint planning from task brief to approved implementation plan. Reads the repo, designs sprint phases with ownership, validates AI orchestration, and delivers a plan ready for the implementation team.

## When to Use

- You have an implementation task that needs a structured sprint plan before coding starts
- The task spans multiple sprints (auth removal, database changes, new feature layers)
- You want sprint ownership assigned per phase (owner, lead orchestrator, executor, code reviewer, test reviewer, security reviewer)
- You need the AI orchestration validated before dispatching the implementation team
- You came from `/team-tech-brainstorm` and have an approved Feature Brief ready for sprint planning

Do NOT invoke if you want to start coding immediately — this team plans first, never implements.

## What You Need Before Starting

- Target repo path(s) — full absolute paths, confirmed by user
- Task scope — what is included, what is explicitly excluded
- Any existing sprint plan, Feature Brief, or spec for this task
- Decisions already made (auth provider, database, countries to block, etc.)

## What This Team Produces

1. **Codebase Report** (`repo-mapper`) — package audit, directory map, DB schema, existing services, auth footprint, test coverage
2. **Sprint Plan Draft** (`sprint-architect`) — all sprints with ownership matrix, TDD tests, workflow assignments, dependency map
3. **Orchestration Validation Report** (`orchestration-validator`) — 8-gate check: agent existence, TDD compliance, concurrency safety, ownership completeness, security coverage, git-ops integrity, codebase report fidelity, verif-code-gate
4. **Final Sprint Plan** — written to `docs/sprints/{slug}-sprint-plan.md` after user approval
5. **Orchestration Check** — written to `docs/sprints/{slug}-orchestration-check.md`

## Agent Sequence

1. `sprint-planner-lead` — runs clarification gate: repo paths, scope, ambiguities, existing plans. Does NOT proceed until all ambiguities resolved.
2. `repo-mapper` — reads target repos. Read-only. Produces Codebase Report.
3. `sprint-architect` — designs sprint phases from Codebase Report + confirmed scope. Selects teams/workflows. Produces Sprint Plan Draft.
4. `orchestration-validator` — validates Sprint Plan Draft against 8 gates (including verif-code-gate). Returns PASS/WARN/FAIL. FAIL gates return to sprint-architect.
5. `sprint-planner-lead` — presents final plan to user for approval. Writes to docs/sprints/ after approval.

## Ownership Matrix (enforced per sprint)

Every sprint must have:
- **Owner** — the agent or role accountable for the sprint outcome
- **Lead Orchestrator** — the team/skill that orchestrates
- **Executor** — the team/skill that does the work
- **Code Reviewer** — architect + relevant senior engineer (cannot be the executor)
- **Test Reviewer** — tester-backend or tester-frontend (cannot be the executor)
- **Security Review** — team-threat-defense (auth/fraud/payments) or sec-devops (pre-commit) or N/A (pure UI with no API changes)
- **git-ops commits after** — commit message format

## TDD Enforcement

- At least 1 failing test written BEFORE implementation starts in every sprint with code tasks
- Tests are never modified to pass — fix the code, not the test
- If 3 consecutive test failures occur → team-dev-loop is activated, no code rampage
- Test reviewer signs off before git-ops commits

## Key Rules

- `sprint-planner-lead` never dispatches implementation — that is user-triggered after plan approval
- `repo-mapper` is read-only — no edits, no commits, no assumptions
- `orchestration-validator` never invents agents to fix FAIL gates — returns failure to lead
- Plans with FAIL gates are not shown to user until resolved
- `sprint-architect` always assigns `team-dev-loop` as default executor unless there is an explicit reason to deviate
- Security sprints are mandatory for auth, fraud, payments, and API route tasks
- `team-production-readiness` is always the final sprint

## How to Invoke

Pass to `sprint-planner-lead`:
- Target repo path(s)
- Task description
- Any confirmed decisions or existing spec

The lead runs the clarification gate before dispatching any agent.
