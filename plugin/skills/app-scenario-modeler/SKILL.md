---
name: app-scenario-modeler
description: Software scenario modeling team — discovers, classifies, and stress-tests all scenarios for a feature or application. Outputs risk register, cascade map, priority matrix, and stack recommendation per feature in optimaeus-architecture/docs/app-modeler/.
category: dev-skills
---

# App Scenario Modeler

Orchestrates a 6-agent team to fully model every scenario for a software feature or application. Covers happy paths, input variations, concurrency, state conflicts, external failures, security risks, and cascade chain effects. Outputs 6 structured documents per feature in `optimaeus-architecture/docs/app-modeler/[app-name]/`.

## When to Use
- Before building any new feature where failure modes matter
- When a feature has cascade effects (moving one record forces changes in 2+ others)
- When stakeholders disagree on which edge cases to handle
- After a brainstorm or tech-brainstorm session, before implementation begins
- When a live feature produces unexpected errors and coverage gaps need mapping

## What You Need Before Starting
- App name (for output directory)
- Feature name and one-sentence description
- Desired outcome (what success looks like from user and system perspective)
- Target user type (non-technical / technical / API consumer / admin)
- Known stack and constraints
- Any prior brainstorm or spec output to feed as context

## What This Team Produces

6 files per feature written to `optimaeus-architecture/docs/app-modeler/[app-name]/`:

| File | Content |
|---|---|
| [feature]-scenario-[YYYY-MM-DD].md | Full scenario matrix — all Sn with tier, risk, outcomes |
| [feature]-constraints-[YYYY-MM-DD].md | Technical + business constraint mapping |
| [feature]-risk-register-[YYYY-MM-DD].md | CRITICAL + HIGH scenarios with mitigation |
| [feature]-stack-rec-[YYYY-MM-DD].md | Tech stack per scenario tier |
| [feature]-priority-matrix-[YYYY-MM-DD].md | Ranked implementation order with Expected_impact |
| [feature]-cascade-[YYYY-MM-DD].md | Cascade chain analysis (written when CASCADE_RISK = yes) |

## Agent Sequence

1. **lead-scenario** — Phase 1 intake + orchestration + final synthesis
2. **scenario-discoverer** — Phase 2: 6-category discovery, minimum 8 scenarios
3. **scenario-classifier** — Phase 3+4: tier labels + full scenario matrix
4. **constraint-analyst** — Phase 5: technical + business constraint mapping
5. **optimisation-strategist** — Phase 6: CORE tier optimisation + long-term stack
6. **edge-cost-analyst** — Phase 7: EDGE/FRINGE Expected_impact + cascade analysis

Max 3 agents active at once. Phases run sequentially. lead-scenario reviews after each phase before the next starts.

## Key Rules
- Never skip a phase — each feeds the next
- CASCADE_RISK must be declared in Phase 1 — drives whether cascade file is produced
- FRINGE + CRITICAL scenarios must be escalated — never SKIP without explicit user sign-off
- Final output package shown to user for approval before files are written to disk
- One team run = one feature. Run again for each additional feature in the same app.
