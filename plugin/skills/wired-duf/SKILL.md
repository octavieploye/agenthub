---
name: wired-duf
description: Data-UX-Functionality audit — verifies all user-facing data is relevant, all UI elements are functional, and all frontend-backend wiring is complete
category: dev-skills
---

# Wired DUF (Data - UX - Functionality)

Systematic audit that traces every user-facing view from rendered component to backend data source, flagging irrelevant data, broken controls, silent failures, and unwired endpoints.

## When to Use

- After a feature sprint — verify everything landed correctly
- When a user reports "empty data" or "broken buttons" in the UI
- Before a release — full data relevance + functionality sweep
- When onboarding to an unfamiliar app — map what works and what doesn't
- Periodic health check on any full-stack application

## What You Need Before Starting

1. **Target repo confirmed** — full path, not CWD assumption
2. **App must be a full-stack app** — frontend + backend (any framework)
3. **Access to both frontend and backend source code** in the repo

## Workflow

### Phase 1 — Parallel Scouting (2 agents)

Dispatch `duf-scout-frontend` and `duf-scout-backend` in parallel:

**Agent 1: `duf-scout-frontend`**
- Enumerate ALL views, tabs, panels, modals in the app
- For each view: list every data-bound element (text, lists, charts, badges, buttons)
- Trace each element to its data source: component → store/hook → API call → endpoint URL
- Flag: hardcoded values, placeholder text, buttons with no handler, empty-state UX gaps
- Output: structured view map with data lineage per element

**Agent 2: `duf-scout-backend`**
- Enumerate ALL API endpoints (routes, controllers)
- For each endpoint: trace to data source (DB table, external service, Anamnesis, LLM)
- Identify: stub endpoints (return hardcoded data), unhandled error paths, silent failures (catch → empty response)
- Map DB tables → which endpoints serve them → are they consumed by any frontend component
- Output: structured endpoint map with data source per route

### Phase 2 — Integration Cross-Check (1 agent)

Dispatch `duf-integration-verifier` after both scouts complete:

- Cross-reference frontend API calls against backend endpoint list
- Cross-reference backend DB tables against frontend rendering
- Identify: endpoints called by frontend but missing in backend, backend tables with no frontend consumer, type mismatches between API response and frontend expectations, error response format mismatches
- Run type-check (tsc/mypy) on modified files if applicable
- Run existing tests to catch regressions
- Output: integration gap report

### Phase 3 — Classification & Report

The coordinator (you) compiles all findings into a single report:

**Severity classification:**

| Severity | Definition | Examples |
|---|---|---|
| **BROKEN** | Feature exists but does not work | Button with no handler, endpoint returns 500, silent 200 on failure |
| **IRRELEVANT** | Data shown is wrong or misleading for the context | Ecosystem signals on project view, internal decisions shown to users |
| **INCOMPLETE** | Partial implementation, missing pieces | Form missing fields, API returns data but UI doesn't render it |
| **COSMETIC** | Works but UX is suboptimal | Hardcoded label, missing loading state, no empty-state message |

**Report format:**

```markdown
## DUF Audit Report — {App Name}
Date: {date}
Repo: {path}

### Summary
- Views audited: N
- Endpoints audited: N
- Findings: X BROKEN, Y IRRELEVANT, Z INCOMPLETE, W COSMETIC

### Findings

#### BROKEN
| # | View/Endpoint | Issue | File:Line | Root Cause |
|---|---|---|---|---|

#### IRRELEVANT
| # | View/Endpoint | Issue | File:Line | Root Cause |
|---|---|---|---|---|

#### INCOMPLETE
| # | View/Endpoint | Issue | File:Line | Root Cause |
|---|---|---|---|---|

#### COSMETIC
| # | View/Endpoint | Issue | File:Line | Root Cause |
|---|---|---|---|---|

### Wiring Map
{Frontend component} → {Store/Hook} → {API endpoint} → {Backend handler} → {Data source}
(one row per data flow, mark gaps with X)
```

### Phase 4 — Fix Wave (conditional)

If the user approves fixes:
- Dispatch `dev-backend` and `dev-frontend` agents in parallel with specific fix instructions from the report
- Each agent fixes only BROKEN and IRRELEVANT items (INCOMPLETE and COSMETIC are optional, user decides)
- After fixes: re-run Phase 2 verification
- Commit via git-ops following `.claude/commands/git-commit.md`

## Output

1. **DUF Audit Report** — structured findings with file:line references and severity
2. **Wiring Map** — complete data lineage from UI element to data source
3. **Fixes** (Phase 4, if approved) — committed code changes

## Constraints

- **Read-only until Phase 4** — Phases 1-3 are investigation only
- **Max 3 agents active at any time** — scouts run in parallel (2), then verifier (1), then fixers (2)
- **Never fix without user approval** — present the report, wait for go-ahead
- **Never change tests to pass** — fix the code, not the test
- **Repo gate applies** — confirm target repo before dispatching any agent
- See `criteria.md` for the full audit checklist

## Common Mistakes

| Mistake | Fix |
|---|---|
| Scanning only the "main" views, missing modals/drawers/settings | Enumerate ALL routes + all components rendered conditionally |
| Reporting empty data as "broken" when no data exists yet | Distinguish "no data source wired" from "data source wired but empty" |
| Missing silent failures (200 OK with empty array) | Check every catch block — does it swallow errors or surface them? |
| Not checking error response format alignment | Backend error shape must match what frontend parses |
| Treating build artifacts as source files | Never read/commit dist/, build/, .tsbuildinfo files |
