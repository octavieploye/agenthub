# MANIFEST — Design Research Workflow
Version: 1.0
Modes: LINEAR

## Purpose

Research and synthesize current web design trends, emotional UX patterns, and animation/interaction techniques for software landing pages. Output: a single Design Research Brief ready for use by dev-frontend or ux-architect.

## LOAD ORDER

1. Always load ALL core/ modules first
2. Run phases in order: p1 → p2 → p3 → synthesis
3. Lead reviews output between each phase before activating the next agent

## CORE (always load)

core/design-principles.md    Universal research standards and non-assumption rules for this team

## PHASE MODULES (run in order)

phases/p1-trend-harvest.md       Phase 1 — competitor-trend-researcher: landing layout, typography, color, UI conventions
phases/p2-emotion-patterns.md    Phase 2 — emotion-ux: trust signals, delight, friction, onboarding arc
phases/p3-animation-patterns.md  Phase 3 — animation-engineer: Tailwind animations, scroll/event triggers

## SYNTHESIS

synthesis/brief-template.md    Final Design Research Brief template — compiled by lead-design-research

## Output Location

docs/design-research/[YYYY-MM-DD]-[slug]-design-brief.md
