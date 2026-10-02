---
name: agent-memory
description: Create, audit, and archive per-repo AI agent memory files (.llm/{category}-memory.md). Tracks what agents worked on so the next agent gets context quickly.
category: meta
---

# Agent Memory

Manage per-repo memory files that give AI agents fast context about recent work.

## When to Use

- Starting work in a repo that has no `.llm/*-memory.md` files yet
- User asks to create a memory file for a new domain (code, marketing, business, etc.)
- User asks to audit memory vs git history for drift
- User asks to archive old entries (>30 days)

## What This Skill Produces

- `.llm/{category}-memory.md` in the **target repo** (not agenthub)
- `.llm/memory-archive/{category}-{YYYY-MM}.md` when archiving
- `.llm/memory-archive/index.md` updated after each archive run
- Discrepancy reports when git and memory diverge

## Step 0 — Repo Gate

Confirm the target repo with the user. The memory file is created in the repo the agent is working in, not in agenthub. State the full path and wait for confirmation.

## Step 1 — Determine Operation

| User says | Operation |
|-----------|-----------|
| "create memory for code" / "set up memory" | **Create** |
| "check memory" / "audit memory" | **Audit** |
| "archive old entries" / "clean up memory" | **Archive** |

## Step 2a — Create

1. Ask the user for the **category** name (or accept from input). Standard categories:

| Category | Default sub-sections |
|----------|---------------------|
| `code` | Backend, Frontend, DB/Migrations, Integration, Testing, Infrastructure |
| `marketing` | Market Research, Competitive Analysis, Content Strategy, SEO/GEO, Campaigns |
| `business` | Strategy, Positioning, Pricing, Revenue, Partnerships |
| `design` | UIUX, Graphic Identity, Branding, User Research |
| `legal` | Compliance, Policy, Licensing, Data Protection |
| `research` | Sources, Analysis, Findings, Open Questions |

User may provide custom category names and sub-sections. These defaults are suggestions, not constraints.

2. Check if `.llm/{category}-memory.md` already exists in the target repo. If yes, report and ask before overwriting.

3. Create the file with this template:

```markdown
# {Category} Memory — {repo-name}

> Last sync: {current-HEAD-hash} | {today-date} | {agent-role}
> Commits since last sync: 0

## {Sub-section 1}

## {Sub-section 2}

...
```

4. Inform the user: "Created `.llm/{category}-memory.md` in {repo-path}. This file is git-tracked for accountability."

## Step 2b — Audit

1. Read all `.llm/*-memory.md` files in the target repo.
2. Run `git log --oneline -20` to get recent commits.
3. Extract the `Last sync` commit hash from each memory file.
4. Compare:
   - **Commits after last sync hash** → report: "X commits happened since last memory sync — context may be stale."
   - **Memory entries referencing commits not in git log** → report: "Memory references commit {hash} not found in recent history — possible branch switch or rebase."
   - **No memory files found** → report: "No memory files found. Run `/agent-memory create {category}` to set up."
5. Present findings to the user.

## Step 2c — Archive

1. Read each `.llm/*-memory.md` file.
2. For each entry, parse the date `[{YYYY-MM-DD}]`.
3. Entries older than 30 days → move to `.llm/memory-archive/{category}-{YYYY-MM}.md`.
4. Create the archive file if it doesn't exist, preserving sub-section structure.
5. Update `.llm/memory-archive/index.md`:

```markdown
# Memory Archive Index

## {Category}
- [{YYYY-MM}]({category}-{YYYY-MM}.md) — {count} entries | {Sub-section}({count}) {Sub-section}({count})
```

6. Remove archived entries from the active memory file.
7. Report: "Archived X entries from {category}-memory.md to memory-archive/."

## Entry Format (for all agents)

Every agent that completes work in a repo with memory files MUST append an entry:

```
- [{YYYY-MM-DD}] {agent-role}: {task summary} — {commit-hash|no commit} [{status}]
```

**Status tags** (from universal vocabulary):
- `[done]` — task completed successfully
- `[in-progress]` — task started, not finished
- `[blocked — {reason}]` — task cannot proceed
- `[cancelled]` — task explicitly stopped

**Examples:**
```
- [2026-08-04] dev-backend: added rate-limiting to /api/sprints — abc1234 [done]
- [2026-08-04] scout-frontend: mapping component tree — no commit [done]
- [2026-08-03] architect: proposed cache layer [blocked — waiting on DB decision]
```

## Agent-to-Category Mapping

| Agent role | Category file | Sub-section |
|-----------|--------------|-------------|
| dev-backend, tester-backend, scout-backend, sr-backend | code | Backend |
| dev-frontend, tester-frontend, scout-frontend, sr-frontend | code | Frontend |
| dev-integration, scout-integration | code | Integration |
| architect, troubleshooter | code | Integration |
| ux-architect, persona-nontechuser | design | UIUX |
| market-researcher, competitive-intel-marketing | marketing | Market Research |
| content-creator, content-strategist | marketing | Content Strategy |
| strategist, business-analyst, positioning-expert | business | Strategy |
| ceo-advisor, ceo-coaching-* | business | Strategy |
| legal-scanner, policy-writer | legal | Compliance |
| git-ops | (updates Last Sync header only) |

If an agent's category file doesn't exist → report to user: "No `{category}-memory.md` found in this repo. Should I create it?"

## Lead Dispatch Instructions

When the lead dispatches an agent to any repo, include this in the agent prompt:

> After completing your task, append to `.llm/{category}-memory.md` under the `## {sub-section}` heading.
> Format: `- [{YYYY-MM-DD}] {your-role}: {summary} — {commit-hash|no commit} [{status}]`
> If `.llm/{category}-memory.md` does not exist, inform the user and offer to create it.
> If your role's sub-section does not exist, inform the user and offer to add it.

## Key Rules

- Memory files are **git-tracked** — they are accountability artifacts, not ephemeral state
- Never overwrite an existing memory file without user approval
- Never remove entries from active memory — only archive moves entries
- The `Last sync` header is updated by git-ops after each commit
- If git history and memory diverge, report to user — do not auto-resolve

## Pitfalls

- Agent writes to wrong sub-section → memory-curator catches this during audit
- Memory file grows unbounded → archive operation trims entries >30 days
- Branch switch makes commit hashes invalid → audit reports this as a discrepancy, not an error
