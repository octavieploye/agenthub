---
name: team-project-status-report
description: Project Status Report Team Orchestrator — full project oversight for multi-product ecosystems. 6 agents in 3 phases produce a structured, PDF-ready status report with exec summary, product matrix, dependency map, risk register, and ordered action plan.
category: business-intelligence
---

# Team Project Status Report

Full project oversight for multi-product ecosystems. Invokes 6 specialist agents in 3 phases to produce a structured, PDF-ready status report covering all products and packages.

## When to Use

- "What is the status of this project?"
- "Give me a full status report across all products"
- "Create a PDF report of the project state"
- Before any milestone, investor meeting, or launch decision
- Weekly or monthly status reviews for multi-product ecosystems

## What You Need Before Starting

No input required beyond the target scope. The team reads from source code, package manifests, docs, plans, and specs across all products in scope.

## What This Team Produces

- Executive Summary (3-5 sentences — all CRITICAL risks included)
- Product Status Matrix (all products: phase, LRS, classification, biggest blocker)
- Per-product detailed status (feature counts, gaps, pre-ship checklist, readiness scores)
- Cross-product dependency map (direct deps, shared deps, build sequence, version conflicts)
- Risk register (CRITICAL → HIGH → MEDIUM → LOW with remediation)
- Ordered action plan (CRITICAL blockers → P0 → READY → PLANNING)
- PDF export instructions

## Step 0 — Repo Gate (mandatory, blocks all other steps)

State the full target path or project and confirm with the user before dispatching any agent or reading any file. CWD is not confirmation. STOP AND ASK if the target repo or project is not explicit in the user's message.

## Agent Sequence

### Phase 1 — Expert Trio (parallel, 3 agents max)
1. `product-expert` — per-product feature inventory + gap analysis + pre-ship checklist
2. `package-expert` — package/dependency inventory + distribution gaps + build sequence
3. `risk-manager` — risk register (legal, technical, business, infrastructure, IP)

### Phase 2 — Investigation Pair (parallel, 2 agents)
4. `feature-investigator` — full cross-project feature matrix (7 categories, 6 status values)
5. `readiness-analyst` — launch readiness score per product (5 components, 0-100 LRS)

### Phase 3 — Synthesis (lead alone)
6. `lead-status` — dependency map + action plan + final report assembly + file write

## Key Rules

- CRITICAL risks from risk-manager appear in the Executive Summary — never buried in appendix
- Report is saved to file before declaring done — not just output to terminal
- Never produce a report from memory alone — always run the full agent sequence
- Products in PLANNING phase must be included
- The dependency map must be accurate — do not simplify by omitting dependencies
- Lead does NOT deep-research — all research is delegated to specialist agents
- Phase 2 agents require Phase 1 data as pre-condition — do not run them early

## How to Invoke

Say: "Run the project status report" or "Give me a full project status" or invoke `/team-project-status-report`.

Lead agent (`lead-status`) orchestrates the full sequence automatically.
