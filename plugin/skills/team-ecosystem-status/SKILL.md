---
name: team-ecosystem-status
description: Ecosystem Status Team Orchestrator — full project oversight across AgentHub, OPTimaeus, LLM Packages, and Opeidos. Produces a PDF-ready status report with risk register, feature matrix, and ordered action plan.
category: business-intelligence
---

# Team Ecosystem Status

Full project oversight for the Optimaeus ecosystem. Invokes 5 specialist agents in 3 phases to produce a structured, PDF-ready status report covering all 4 products.

## When to Use

- "What is the status of everything?"
- "What do I need to do before launch?"
- "Give me a full project overview"
- "Create a PDF report of the project state"
- Before any milestone, investor meeting, or launch decision
- Weekly or monthly status reviews

## What You Need Before Starting

No input required. The team reads from:
- AgentHub codebase (`src/`, `docs/superpowers/plans/`)
- OPTimaeus project (`/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/`)
- All packages (`agenthub/packages/`, `optimaeus-architecture/shared/`)
- Opeidos strategy plans in `docs/superpowers/plans/`
- Risk scan: `docs/brainstorm/`, `docs/marketing/`, all `package.json` license fields

## What This Team Produces

- `docs/superpowers/ecosystem-status-{YYYY-MM-DD}.md` — the full report
- Executive Summary (3-5 sentences — all CRITICAL risks included)
- Product Status Matrix (all 4 products: phase, readiness, biggest blocker)
- Per-product detailed status
- Cross-product dependency map
- Risk register (CRITICAL → HIGH → MEDIUM → LOW)
- Ordered action plan (CRITICAL blockers → P0 → READY → PLANNING)
- PDF instructions (pandoc command or print-to-PDF)

## Agent Sequence

### Phase 1 — Expert Trio (parallel, 3 agents max)
1. `agenthub-expert` — AgentHub feature inventory + monetization gap analysis + pre-ship checklist
2. `optimaeus-expert` — OPTimaeus build phase + P0 blocker analysis + readiness estimate
3. `llm-pckg-expert` — Package inventory + distribution gaps + build sequence

### Phase 2 — Investigation Pair (parallel, 2 agents)
4. `feature-investigator` — Full cross-project feature matrix (all categories: coding/business/admin/legal/content/design/infra)
5. `risk-manager` — Risk register (celebrity names, licenses, trademarks, technical, infra)

### Phase 3 — Synthesis (lead alone)
6. `lead-ecosystem` — Dependency map + action plan + final report assembly + file write

## Key Rules

- CRITICAL risks from risk-manager appear in the Executive Summary — never buried in appendix
- Report is saved to file before declaring done — not just output to terminal
- Never produce a report from memory alone — always run the full agent sequence
- Opeidos must be included even though it is not yet built
- The dependency map must be accurate — do not simplify by omitting dependencies
- Lead does NOT deep-research — all research is delegated to specialist agents

## How to Invoke

Say: "Run the ecosystem status team" or "Give me the full project overview" or invoke `/team-ecosystem-status`.

Lead agent (`lead-ecosystem`) orchestrates the full sequence automatically.
