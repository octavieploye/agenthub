# Notion Memory Spec — Agent Entry Format

Every agent MUST append an entry to `.llm/notion/[repo-name]-notion-memory.md` in the agenthub repo after completing any task. This file is LLM-oriented — no prose, structured fields only.

## File Location

```
agenthub/.llm/notion/
  agenthub-notion-memory.md
  opeidos-notion-memory.md
  optimaeus-notion-memory.md
  hephaestus-notion-memory.md
  logos-notion-memory.md
  hermes-notion-memory.md
  demiurge-notion-memory.md
  optimaeus-architecture-notion-memory.md
  workflow-server-api-notion-memory.md
```

One file per repo. Create the file if it does not exist.

## Entry Format

```
---entry
date: YYYY-MM-DD
agent: [agent-name]
repo: [repo-name]
type: sprint|research|plan|fix|architecture|deployment|business|marketing|financial|security|legal
summary: [one sentence — what was done]
paths: [key files touched, comma separated]
tasks_done: [list of completed items]
todos: [remaining items for agents]
human_tasks: [things only the human can do — create accounts, sign contracts, etc.]
git_refs: [commit hashes if applicable]
status: done|partial|blocked
blocking_reason: [only if status=blocked]
---
```

## Rules

- One entry per task completion — do not batch multiple tasks
- `summary` must be a single sentence a CEO could understand
- `paths` should reference actual source files, not docs
- `human_tasks` are for things that require human action outside the codebase (create OVH account, sign contract, configure DNS, etc.)
- `git_refs` are optional — include when code was committed
- `type` must be one of the listed values — do not invent new ones
- Do not edit or delete previous entries — append only
- Entries are consumed by the Notion agent — it reads these to update Notion

## Example

```
---entry
date: 2026-08-08
agent: dev-backend
repo: opeidos
type: architecture
summary: Replaced Clerk authentication with Better Auth across all routes
paths: src/auth/, src/middleware/auth.ts, src/lib/better-auth.ts
tasks_done: [removed Clerk SDK, installed Better Auth, migrated session logic, updated middleware chain]
todos: [update env vars on Coolify, test OAuth flow in staging]
human_tasks: [create Better Auth dashboard account, update Cloudflare DNS for auth subdomain]
git_refs: [abc1234, def5678]
status: done
---

---entry
date: 2026-08-08
agent: strategist
repo: optimaeus-architecture
type: business
summary: Completed pricing analysis for OPTimaeus standalone vs subscription tiers
paths: affiliate/2026-08-08-pricing-analysis.md
tasks_done: [competitor price mapping, willingness-to-pay model, 3 revenue scenarios]
todos: [validate with wave-1 beta users]
human_tasks: [decide final price point, configure LemonSqueezy tiers]
git_refs: []
status: done
---
```
