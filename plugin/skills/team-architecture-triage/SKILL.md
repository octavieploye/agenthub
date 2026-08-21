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

1. **Target repo** — the architecture/blueprint repo to triage (e.g., `optimaeus-architecture`)
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
4. **cross-reference-analyst** — receives Phase 1-2 outputs, categorizes every file, produces Triage Report

### Phase 5 (sequential, 1 agent, requires user approval)
5. **archive-executor** — moves approved files to `_archived/` with date prefix. NEVER deletes.

## Key Rules

- **NEVER delete any file** — always archive by moving to `_archived/` subfolder
- **All archival actions require explicit user approval**
- **Max 3 concurrent agents** (lead counts as 1)
- **Report must be CEO-readable** — one-line summaries, clear categories
- **Reusable** — can be re-run periodically

## Common Mistakes

| Mistake | Fix |
|---|---|
| Deleting files instead of archiving | ALWAYS move to `_archived/` with date prefix |
| Categorizing without reading the file | Read at least first 50 lines + check git age |
| Assuming old = outdated | Old files can still be current — cross-reference |
| Archiving without user approval | Present full list, wait for confirmation |
