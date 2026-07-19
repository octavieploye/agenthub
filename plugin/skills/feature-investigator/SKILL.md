---
name: feature-investigator
description: Cross-project feature tracker — maps planned, implemented, and waiting features across AgentHub, OPTimaeus, Opeidos, and LLM packages. Covers coding tasks, business tasks, admin tasks, and legal tasks.
category: intelligence
---

# Feature Investigator

Cross-project feature tracker for the full Optimaeus ecosystem. Surfaces what is planned, implemented, in progress, or waiting — across all four products and all task categories.

## When to Use

- "What features are planned but not built across all products?"
- "What is waiting to be started?"
- "Give me a full feature status across AgentHub, OPTimaeus, Opeidos, and the packages"
- "What business tasks are pending?"
- "What legal or admin work is outstanding?"
- Any cross-project "what needs to happen" question

## What You Need Before Starting

- `agenthub/docs/superpowers/plans/` — all plan files with Status fields
- `agenthub/docs/superpowers/specs/` — spec files
- `agenthub/docs/todo-business/` — business TODOs
- `agenthub/human-task.md` — any human task list
- `agenthub/features.md` — feature list if it exists
- `agenthub/.claude/projects/.../memory/MEMORY.md` — project memory for open workstreams
- OPTimaeus project README and DEVELOPMENT-PLAN.md

## Task Categories

| Category | Description |
|---|---|
| CODING | Implementation tasks requiring code changes |
| BUSINESS | Market research, positioning, GTM, pricing decisions |
| ADMIN | License setup, npm org, signing certs, legal entity, accounts |
| LEGAL | License review, trademark clearance, EULA, ToS, celebrity names |
| CONTENT | Landing pages, docs, blog posts, onboarding copy |
| DESIGN | UI/UX work, icons, brand identity, installer screens |
| INFRA | Auto-update server, deployment, CI/CD, package registry |

## Status Vocabulary

| Status | Meaning |
|---|---|
| DONE | Implemented and verified |
| IN_PROGRESS | Actively being worked, partially complete |
| READY | Spec/plan complete, can start immediately |
| WAITING | Blocked by a dependency or decision |
| PLANNING | Being scoped, no spec yet |
| REJECTED | Decided not to build |

## Workflow

1. Read all plan files in `docs/superpowers/plans/` — extract feature name, product, status
2. Read all spec files in `docs/superpowers/specs/` — extract feature name, product, status
3. Read `docs/todo-business/` and `human-task.md` for non-coding tasks
4. Read `features.md` if it exists
5. Check OPTimaeus DEVELOPMENT-PLAN.md for its feature list
6. Categorize each item: product (AgentHub / OPTimaeus / Opeidos / Packages), category (CODING/BUSINESS/ADMIN/LEGAL/CONTENT/DESIGN/INFRA), status
7. Output: full cross-product feature matrix + prioritized waiting list

## Output

Two outputs:

**1. Full Feature Matrix** — one table per product:
| Feature | Category | Status | Plan/Spec file | Blocker (if WAITING) |
|---|---|---|---|---|

**2. Priority Action List** — ranked by:
1. BLOCKER items (blocking monetization)
2. READY items (can start now)
3. WAITING items (need decision or dependency resolved)
4. PLANNING items (need scoping)

## Constraints

- Cover all 4 products: AgentHub, OPTimaeus, Opeidos, LLM Packages
- Cover all 7 task categories — do not skip LEGAL and ADMIN
- Do not omit items just because they are non-coding
- If a plan file has no Status field, mark as UNKNOWN and flag it
- Do not make up feature names — only report what is in files
- Do not make recommendations — surface and categorize only
