---
name: team-integrity-status
description: Integrity Status Team Orchestrator — 4-phase audit across migrations, DB schema, backend, API contracts, frontend, and CI/CD. Produces per-layer Integrity Status Report with CRITICAL/HIGH/MEDIUM/LOW severity, issues list, missing code/tests/config, and action plan. Review gates with sr-backend/sr-frontend. Optional team-dev-loop for fixes.
category: dev-skills
---

# Integrity Status Team

Full-stack integrity verification audit across all layers of a target application.

## When to Use

- After discovering migration crashes, silent skips, or schema drift
- Before a production deployment to verify all layers are aligned
- After a major refactor to check nothing was silently broken
- When mapping a new app to install safety systems
- Periodic health check on any Optimaeus entity

## What You Need Before Starting

- **Target repo path** — confirmed by the user (Repo Gate mandatory)
- **Database access** — connection string or local DB available for schema inspection
- **Tech stack context** — framework, DB type (PostgreSQL/SQLite), migration tool

## What This Team Produces

- **Integrity Status Report** — one document with per-layer sections:
  - Migration Safety (checksums, idempotency, collisions, skips, untracked changes)
  - Infrastructure Health (schema drift, health endpoints, env config, SSL)
  - Backend Quality (route completeness, handler quality, DB query safety, middleware)
  - API Contracts (Zod coverage, OpenAPI presence, breaking changes, type alignment)
  - Frontend Alignment (type propagation, fetch safety, form validation, error boundaries)
  - CI/CD Status (pre-commit hooks, deploy gates, lint pipeline, test config, smoke tests)
- **Issues List** — every finding with severity (CRITICAL/HIGH/MEDIUM/LOW), file:line evidence, and recommended fix
- **Missing Items** — code, tests, configs, or safety mechanisms that should exist but don't
- **Action Plan** — prioritized remediation steps ordered by severity and effort

## Step 0 — Repo Gate (mandatory, blocks all other steps)

State the full target repo path and confirm with the user before dispatching any agent or reading any file. CWD is not confirmation. STOP AND ASK if the target repo is not explicit.

## Agent Sequence (mandatory order)

### Phase 1: MAP (parallel, 3 agents)

1. `integrity-migration` — scans all migration files, checks migrator code, verifies checksums, tests idempotency patterns, detects ID collisions and silent skips
2. `integrity-infra` — compares schema snapshot vs live DB, checks health endpoints, startup assertions, env config validation, SSL configuration
3. `integrity-cicd` — audits CI/CD pipeline presence, pre-commit hooks, deploy gates, migration lint, type-check pipeline, post-deploy smoke tests

**Checkpoint 1**: Lead reviews all Phase 1 findings. Raises issues and blockers. Cross-references migration findings with schema state.

### Phase 2: VERIFY (parallel, 3 agents)

4. `integrity-backend` — scans API routes, handler implementations, error handling patterns, DB query type safety, middleware coverage
5. `integrity-contract` — checks Zod validation coverage per route, OpenAPI spec presence and freshness, breaking change detection, request/response type alignment
6. `integrity-frontend` — checks component-to-API alignment, type propagation from backend, fetch call type safety, form validation coverage, error boundary presence

**Checkpoint 2**: Lead reviews all Phase 2 findings. Cross-references with Phase 1 findings (e.g., schema changes that affect API contracts that affect frontend types).

### Phase 3: REVIEW (sequential, 1 agent + review gate)

7. `integrity-architect` — reviews ALL findings from Phase 1 and Phase 2. Identifies cross-layer issues. Validates severity ratings. Produces priority-ranked architectural assessment.

**Review Gate**: Lead invokes `sr-backend` and `sr-frontend` (from dev-stack team) to validate the architect's findings and add code-level review notes.

**Checkpoint 3**: Architect + lead + senior reviewers produce final validated assessment.

### Phase 4: SYNTHESIZE

Lead assembles the Integrity Status Report from all validated findings.

**If issues found**: Lead presents the report and offers to trigger `/team-dev-loop` for automated fixes (requires user approval).

## Key Rules

- **Read-only audit** — no code changes during the integrity check unless user explicitly approves fixes via team-dev-loop
- **Every finding needs evidence** — file path, line number, or SQL query. No vague warnings.
- **Cross-layer issues are CRITICAL** — if a migration problem cascades to API contracts to frontend types, that chain is one finding rated at the highest severity in the chain
- **Never skip a checkpoint** — lead must review and acknowledge findings before moving to the next phase
- **Repo Gate is Phase 0** — no agent runs without confirmed target repo
- **Tech-stack adaptive** — the same team works on PostgreSQL (Opeidos, Logos) and SQLite (AgentHub) apps. Agents adapt their checks to the detected stack.

## How to Invoke

Tell the lead which repo to audit. Lead confirms the repo, runs Phase 0 (Repo Gate), then dispatches the 4-phase sequence automatically.

Example: `"Run integrity-status on /Users/octaviesmacpro/workspace/optimaeus-projects/opeidos"`
