---
name: team-architecture-triage
description: Architecture Triage Team Orchestrator — inventories a blueprint repo, cross-references against 12 live repos, categorizes every file (CURRENT/IMPLEMENTED/OUTDATED/RESEARCH/ABANDONED/FUTURE), produces triage report, executes user-approved archival. NEVER deletes files.
category: business-intelligence
---

# Architecture Triage Team

Systematically triage an architecture/blueprint repo against live project repos. Categorize every file by freshness and relevance. Produce a CEO-readable triage report. Execute approved archival actions.

## When to Use

- Architecture repo has not been updated for a while and needs organizational cleanup
- User wants to know what in the blueprint is still accurate vs. outdated vs. implemented
- Before a major planning session that needs clean, current architecture docs
- Periodic hygiene pass on the blueprint repo

## What You Need Before Starting

1. **Target repo** — the architecture/blueprint repo to triage (e.g., `optimaeus-llm`)
2. **Live repo list** — all repos that represent current reality, with paths and status
3. **User confirmation** — explicit approval of target + live repo list before proceeding

## Live Repos (Optimaeus Ecosystem — update this list as repos change)

| # | Repo | Path | Status |
|---|---|---|---|
| 1 | Hephaestus (commercial) | `/Users/octaviesmacpro/workspace/optimaeus-stacks/hephaestus` | Active |
| 2 | Hephaestus Sovereign | `/Users/octaviesmacpro/workspace/optimaeus-stacks/hephaestus-sovereign` | Active |
| 3 | LLM Workflows Package | `/Users/octaviesmacpro/workspace/optimaeus-stacks/llm-workflows-pckg` | Active |
| 4 | Data Gouv Hub | `/Users/octaviesmacpro/workspace/optimaeus-stacks/data-gouv-hub` | Not yet built |
| 5 | Optimaeus Commercial | `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus-commercial` | In progress |
| 6 | Anamnesis Commercial | `/Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis-commercial` | In progress |
| 7 | Opeidos Marketplace (opeidos.com) | `/Users/octaviesmacpro/workspace/optimaeus-projects/opeidos` | Active |
| 8 | Opeidos Fraud Admin | `/Users/octaviesmacpro/workspace/optimaeus-projects/opeidos-fraud-admin` | Active |
| 9 | Opeidos AI Consultancy (opeidos.fr) | `/Users/octaviesmacpro/workspace/optimaeus-projects/opeidos-ai-consultancy` | Not yet created |
| 10 | Optimaeus (internal tool) | `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus` | In progress |
| 11 | AgentHub (internal dev tool) | `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub` | Active |

## What This Team Produces

1. **Inventory Report** — full directory tree of architecture repo with file ages
2. **Live Repo Census** — what each live repo has implemented from the blueprint
3. **Triage Report** — every file/section categorized with recommended action
4. **Archival Execution** — approved files moved to `_archived/` with date prefix

## Agent Sequence

### Phase 1-2 (parallel, 2 agents + lead)
1. **triage-lead** — confirms scope, dispatches Phase 1-2 agents
2. **inventory-scout** — maps architecture repo: directory tree, file ages via `git log`, content summaries
3. **repo-census-scout** — catalogs each live repo: exists? what's implemented? what's the current state?

### Phase 3-4 (sequential, 1 agent)
4. **cross-reference-analyst** — receives Phase 1-2 outputs, categorizes every file:
   - `CURRENT` — still accurate, matches live state
   - `IMPLEMENTED` — was blueprint, now lives in a real repo (archive candidate)
   - `OUTDATED` — contradicts current reality, needs update or archive
   - `RESEARCH` — valuable reference material not tied to implementation state
   - `ABANDONED` — planned but explicitly dropped
   - `FUTURE` — still planned, not yet built
   - Produces the Triage Report with one-line summaries per file

### Phase 5 (sequential, 1 agent, requires user approval)
5. **archive-executor** — after user reviews and approves the triage report:
   - Creates `_archived/` subdirectories where needed
   - Moves approved files with `YYYY-MM-DD-` prefix
   - NEVER deletes any file — archive only

## Key Rules

- **NEVER delete any file** — always archive by moving to `_archived/` subfolder
- **All archival actions require explicit user approval** — present the full list, wait for confirmation
- **Max 3 concurrent agents** (lead counts as 1)
- **Report must be CEO-readable** — one-line summaries, clear categories, no jargon
- **Git log is the age source** — use `git log --format='%ai' -1 -- <file>` for last-modified dates
- **Reusable** — the skill can be re-run periodically; archived files stay in `_archived/`
- **Cross-reference by content, not just name** — a file may have been renamed or split across repos

## Output Location

Reports are written to `docs/triage/` in the target architecture repo:
- `docs/triage/YYYY-MM-DD-inventory.md`
- `docs/triage/YYYY-MM-DD-census.md`
- `docs/triage/YYYY-MM-DD-triage-report.md`

## Common Mistakes

| Mistake | Fix |
|---|---|
| Deleting files instead of archiving | ALWAYS move to `_archived/` with date prefix |
| Categorizing without reading the file | Read at least the first 50 lines + check git age |
| Assuming a file is outdated because it's old | Old files can still be current — cross-reference against live repos |
| Archiving without user approval | Present full list, wait for explicit confirmation |
| Running more than 3 agents at once | Phase 1-2 parallel (2 + lead), then sequential |
