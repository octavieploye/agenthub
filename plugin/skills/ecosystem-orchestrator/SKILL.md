---
name: ecosystem-orchestrator
description: Lead orchestrator for the Optimaeus ecosystem — invokes all expert skills, aggregates findings, and produces a PDF-ready project evolution report covering AgentHub, OPTimaeus, LLM Packages, and Opeidos.
category: intelligence
---

# Ecosystem Orchestrator

Master oversight skill for the full Optimaeus build. Invokes all product experts, aggregates status across AgentHub, OPTimaeus, LLM Workflow Packages, and Opeidos, and produces a structured PDF-ready report covering current state, risks, and ordered action plan.

## When to Use

- "Give me a full project overview"
- "What is the status of everything?"
- "What do I need to do before launch?"
- "Create a PDF overview of the project"
- "What needs to happen on each product and together?"
- Weekly or milestone status reviews
- Before any investor, partner, or launch conversation

## What You Need Before Starting

No external input required. The orchestrator reads from:
- All 4 product codebases (AgentHub, OPTimaeus, packages/, Opeidos plans)
- `docs/superpowers/plans/` and `docs/superpowers/specs/`
- `docs/superpowers/security/security-log.md`
- Memory files in `.claude/projects/.../memory/`
- All other expert skill outputs (invoked inline)

## Products Covered

| Product | Path | Role |
|---|---|---|
| AgentHub (Hephaestus) | agenthub/ | Runtime + orchestration platform |
| OPTimaeus | /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/ | Strategic intelligence engine |
| LLM Workflow Packages | agenthub/packages/ + optimaeus-architecture/shared/ | Distribution-ready packages for Opeidos |
| Opeidos | Strategy in agenthub/docs/superpowers/ | Marketplace — distribution channel for all products |

## Workflow

### Phase 1 — Expert Snapshots (run in sequence)
1. Invoke `agenthub-expert` → get AgentHub status + pre-ship checklist
2. Invoke `optimaeus-expert` → get OPTimaeus status + P0 blockers
3. Invoke `llm-workflow-pckg-expert` → get package state + distribution gaps
4. Invoke `feature-investigator` → get full cross-project feature matrix
5. Invoke `risk-manager` → get risk register

### Phase 2 — Opeidos Status
Read from:
- `docs/superpowers/plans/2026-07-09-opeidos-non-tech-enterprise-config.md`
- `docs/superpowers/plans/2026-07-09-cerberus-anamnesis-standalone-products.md`
- Any other Opeidos plans/specs

Assess:
- Stack decision status (Next.js + Vercel + Neon + Clerk + LemonSqueezy — approved 2026-07-11)
- Build status (not yet built as of 2026-07-13)
- Cold start package plan (5-10 internal packages needed)
- Cerberus review gate status

### Phase 3 — Cross-Product Dependency Map
Build the actual dependency chain:
- What blocks what
- Which products must be stable before others can launch
- Shared components (optimaeus-llm, Anamnesis write layer)

### Phase 4 — Ordered Action Plan
Produce a prioritized list:
1. CRITICAL blockers (nothing ships without these)
2. P0 per product (blocks that product's launch)
3. Cross-product dependencies (sequencing constraints)
4. Ready-to-start items (no blockers, spec exists)
5. Planning items (need scoping before starting)

### Phase 5 — PDF Report Assembly
Assemble into a single structured document at:
`docs/superpowers/ecosystem-status-{YYYY-MM-DD}.md`

## Output: Report Structure

```markdown
# Optimaeus Ecosystem Status Report
Date: {date}
Version: {report version}

## Executive Summary
{3-5 sentences: overall state, biggest blocker, most important next action}

## Product Status Matrix
| Product | Build Phase | Monetization Ready? | Biggest Blocker |

## AgentHub — Detailed Status
[from agenthub-expert output]

## OPTimaeus — Detailed Status
[from optimaeus-expert output]

## LLM Workflow Packages — Detailed Status
[from llm-workflow-pckg-expert output]

## Opeidos — Detailed Status
[from Opeidos plan files]

## Risk Register
[from risk-manager output — CRITICAL and HIGH only in summary, full register in appendix]

## Cross-Product Dependency Map
[visual dependency chain as ASCII or table]

## Ordered Action Plan
[Phase 1: CRITICAL blockers → Phase 2: P0 per product → Phase 3: Ready to start]

## Appendix
[Full feature matrix from feature-investigator]
[Full risk register]
```

## How to Generate PDF

The report is written as a markdown file. To produce a PDF:
1. Open the markdown file in any markdown renderer that supports print-to-PDF
2. Or run: `pandoc docs/superpowers/ecosystem-status-{date}.md -o ecosystem-status-{date}.pdf`
3. Or use the AgentHub UI file preview panel → browser print → Save as PDF

## Constraints

- Never produce a report from memory alone — always invoke expert skills for live data
- Always include the date and note if any expert skill could not verify its baseline
- CRITICAL risks from risk-manager must appear in the Executive Summary
- The dependency map must be accurate — do not omit a dependency to simplify the picture
- Report is a status document, not a pitch deck — no marketing language, no spin
- Save the report file — do not just output it to the terminal
- Confirm with user before finalizing: "Report saved to docs/superpowers/ecosystem-status-{date}.md. Ready to review?"

## Common Mistakes

| Mistake | Fix |
|---|---|
| Running from memory/MEMORY.md only | Always verify against live files via expert skills |
| Omitting Opeidos (not yet built = easy to forget) | Opeidos is a product. Include it even if status is "not built" |
| Listing Cerberus as an AgentHub dependency | It is not. It is a standalone product + Opeidos review gate. |
| Producing the report without saving it to file | Always write to docs/superpowers/ecosystem-status-{date}.md |
