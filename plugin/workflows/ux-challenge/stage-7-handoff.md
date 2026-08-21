# Stage 7 — Sprint Planner Handoff

**Agent:** lead-ux-challenge
**Active agents:** 1
**Prerequisite:** Stage 6 implementation plan complete

## Purpose
Hand the converged design + implementation plan to /team-sprint-planner for execution. This stage is ALWAYS executed — skipping it is a rule violation.

## Handoff Protocol

### 1. Assemble the Handoff Package
Collect all artifacts:
- Tight Brief: `docs/ux-challenge/[date]-[slug]-tight-brief.md`
- Converged Design: `docs/ux-challenge/[date]-[slug]-converged-design.md`
- Implementation Plan: `docs/ux-challenge/[date]-[slug]-plan.md`
- Three Dials values (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY)
- Mode (WEBSITE / APPLICATION)
- Resolved concern log (from Stage 5)

### 2. Invoke /team-sprint-planner
Pass the handoff package. The sprint planner spawns:
- **team-dev-loop** — builder (implements the plan)
- **frontend-design** — supervisor (enforces anti-AI-slop, bold aesthetics)
- **frontend-wire-verifier** — supervisor (verifies implementation matches the converged design)

### 3. What lead-ux-challenge Does NOT Do After Handoff
- Does NOT supervise implementation (that is sprint-planner's job)
- Does NOT modify the converged design after handoff (changes require a new UX Challenge cycle)
- Does NOT commit any code

## Non-Negotiable Rule
This stage is ALWAYS invoked. The UX Challenge team produces a DESIGN, not code. /team-sprint-planner is the bridge to implementation.
