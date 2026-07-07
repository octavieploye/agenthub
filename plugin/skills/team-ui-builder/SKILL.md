---
name: team-ui-builder
description: UI Builder Team Orchestrator — coherent, non-tech-user-friendly UI from feature request to validated implementation: UX architecture, emotional design, Tailwind/CSS, micro-interactions, non-tech validation
category: dev-skills
---

# UI Builder Team

End-to-end UI build team. Takes a feature request and produces coherent, non-tech-user-friendly UI — from trend research through UX architecture, emotional design, Tailwind/CSS implementation, purposeful micro-interactions, and non-tech validation.

## When to Use

- "Build the UI for X" or "redesign the X screen"
- A feature needs a UI and coherence (not just a component dump)
- You want to ensure non-technical users can actually use what you're building
- You need emotional UX applied — trust signals, onboarding arcs, delight moments
- You want purposeful animations and micro-interactions, not decoration

Do NOT use for:
- Pure research (use `team-design-research` instead — it produces a brief, not code)
- Backend-only features
- Quick one-file component tweaks (just use `dev-frontend` directly)

## What You Need Before Starting

- Feature name and brief description of what it does
- Target user type (tech user, non-tech user, mixed?)
- Any existing design brief (`docs/design-research/`) — if present and < 30 days old, Phase 1 is skipped
- Current codebase access for `scout-frontend` context (optional but recommended)

## What This Team Produces

- `docs/ui-builder/[YYYY-MM-DD]-[feature-slug]-ui-summary.md` — the full UI Build Summary containing:
  - Trend Snapshot (2026 SaaS UI patterns applicable to this feature)
  - UX Component Spec (layout, hierarchy, DaisyUI classes, accessibility notes)
  - Emotional UX Map (trust signals, delight moments, friction points, onboarding arc)
  - Implementation notes + file paths
  - Validation Report (pass/fail per non-tech criterion)

## Agent Sequence

1. **lead-ui-builder** — pre-flight, reads input, checks for existing brief, states phase plan
2. **[Phase 1 — optional]** trend-scout OR Agent+WebSearch — 2026 SaaS UI trend harvest (skip if brief exists)
3. **[Phase 2]** uiux-senior + emotion-ux (parallel, max 2 active) — UX architecture + emotional design
4. **[Phase 3]** dev-frontend + animation-engineer (parallel, max 2 active) — implementation + micro-interactions
5. **[Phase 4]** persona-nontechuser — non-tech validation, pass/fail per criterion
6. **lead-ui-builder** — compiles UI Build Summary, presents to user for approval

## Key Rules

- Max 3 agents active at once (project rule)
- Phases never overlap (Phase 2 complete before Phase 3 starts)
- Validation fails on: jargon visible to user, > 5 steps to primary value, invisible primary action — these trigger a return to Phase 2/3
- Animations: 200-500ms timing, purposeful only (clarify/guide/confirm) — no decorative motion
- Progressive disclosure applies: show the simplest path first, reveal complexity on demand
- No commit without user approval of the UI Build Summary

## Common Mistakes

| Mistake | Fix |
|---|---|
| Starting Phase 3 before Phase 2 outputs reviewed | Lead must review both uiux-senior and emotion-ux outputs first |
| Animation-engineer decorating instead of communicating | Every animation must answer: does this clarify, guide, or confirm something? |
| Skipping persona-nontechuser for "simple" features | Validation is not optional — simple features have the most jargon-blindness risk |
| Using design-research team when you need this team | design-research = research brief only. ui-builder = full implementation |
| Exceeding 3 active agents | Strictly enforce: Phase 2 = 2 agents, Phase 3 = 2 agents, Phase 1/4 = 1 agent |
