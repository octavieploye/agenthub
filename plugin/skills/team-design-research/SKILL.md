---
name: team-design-research
description: Design Research Team Orchestrator — landing page trends, emotional UX patterns, Tailwind animations, and event-triggered interactions for software products
category: dev-skills
---

# Design Research Team Orchestrator

Runs a 4-agent research team that maps current web design trends, emotional UX patterns, and animation/interaction techniques into a single actionable Design Research Brief.

## When to Use

- Before redesigning a landing page or product UI
- When building a new feature that needs design direction
- When you want to know what current SaaS/software landing trends look like
- Before writing Tailwind CSS animation or interaction code
- When you need emotional UX patterns: trust signals, delight, friction reduction

## What You Need Before Starting

- A target product or context (e.g., "AgentHub landing page", "SaaS B2B tool")
- Optional: existing screenshots or references to compare against
- Optional: specific animation or layout questions to focus research

## What This Team Produces

1. **Trend Harvest Report** — current landing page layout patterns, typography, color direction, SaaS UI conventions
2. **Emotional UX Pattern Map** — trust signals, delight moments, friction patterns, onboarding emotion arc
3. **Animation & Interaction Spec** — Tailwind CSS classes, scroll-triggered patterns, hover/click interactions, micro-interaction recipes
4. **Design Research Brief** — synthesis of all three into prioritized design recommendations

## Agent Sequence

1. **lead-design-research** — opens the session, defines scope, activates competitor-trend-researcher
2. **competitor-trend-researcher** — researches and documents current landing page trends (Phase 1)
3. **emotion-ux** — maps emotional UX patterns relevant to the target context (Phase 2)
4. **animation-engineer** — documents animation and interaction patterns (Phase 3)
5. **lead-design-research** — synthesizes all outputs into the final Design Research Brief

## Key Rules

- Never activate more than 3 teammates at once
- Lead does not summarize until all three specialist reports are complete
- competitor-trend-researcher uses WebSearch — 5-source convergence rule applies
- animation-engineer produces implementation specs, NOT production code
- Final brief must be usable by `dev-frontend` or `ux-architect` without re-research
