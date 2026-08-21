---
name: team-ux-challenge
description: UX Challenge Team Orchestrator — adversarial UX↔UI brainstorm + 4-persona critique + least-friction convergence, producing a converged design handed to the sprint planner
category: dev-skills
---

# UX Challenge Team

End-to-end adversarial design team. Takes a target category and produces a converged, user-friendly website/marketplace design — from competitor research through trend extraction, a tight brief, an adversarial UX↔UI pair, six concurrent critics, least-friction convergence, and a plan handed to `/team-sprint-planner`.

## When to Use

- "Design a website/marketplace for [category]" or "redesign the [X] site"
- You want a design that survives adversarial critique before any code is written
- You need the 4 emotional buyer personas (Technical, Sceptical, Time-to-Think, ROI) addressed without conflict
- You want a converged design — not a pile of competing opinions — before implementation

Do NOT use for:
- Pure research (use `team-design-research` instead — it produces a brief, not a converged design)
- Backend-only features
- Quick one-file component tweaks (just use `dev-frontend` directly)
- Implementation (this team hands off to `/team-sprint-planner`, which spawns `team-dev-loop` + `frontend-design` + `frontend-wire-verifier`)

## What You Need Before Starting

- Target category (e.g. "SaaS analytics dashboard", "handmade goods marketplace")
- Whether the output is a WEBSITE or an APPLICATION (drives the workflow mode)
- Any existing design brief — if present and < 30 days old, Stage 1 research is skipped
- Optional: brand constraints (colors, fonts, voice) — if left empty, `ui-designer` selects them post-brainstorm

## What This Team Produces

- `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-trend-brief.md` — competitor teardown + trend extraction (Stage 1)
- `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-tight-brief.md` — the tight brief (Stage 2)
- `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-converged-design.md` — the converged design: layout spec, interaction spec, component mapping, accessibility checklist, friction audit, plain-language labels, copy direction, color/font selection (Stages 3–5)
- `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-plan.md` — the implementation plan handed to `/team-sprint-planner` (Stage 6)

## Agent Sequence

1. **lead-ux-challenge** — Stage 0 intake: confirm category, WEBSITE vs APPLICATION mode, brand constraints, repo target
2. **[Stage 1]** competitor-trend-researcher — websearch same-category sites + chrome-devtools MCP trend extraction (awwwards, i-designaward, land-book, mobbin, refero). Produces trend brief. (1 active)
3. **[Stage 2]** lead-ux-challenge — compresses the trend brief into a tight brief (positioning, audience, emotional arc, constraints)
4. **[Stage 3]** ux-architect + ui-designer — adversarial UX↔UI pair. Dynamic brainstorm rounds until the objection log is empty or two consecutive rounds produce identical objections (stall). (2 active)
5. **[Stage 4]** 6 critics in two waves of 3 — wave 1: technical-critic + sceptical-critic + time-to-think-critic; wave 2: roi-critic + emotional-onboarding + content-layout-expert. Each produces a severity-ranked concern list. (3 active per wave)
6. **[Stage 5]** lead-ux-challenge — least-friction convergence: resolve objections, tie-break on least-friction rule, escalate genuinely-equal trade-offs to the user
7. **[Stage 6]** lead-ux-challenge — lock the stack, write the implementation plan
8. **[Stage 7]** lead-ux-challenge — ALWAYS invoke `/team-sprint-planner` (spawns `team-dev-loop` as builder + `frontend-design` + `frontend-wire-verifier` as supervisors)

## Key Rules

- Max 3 agents active at once (project rule)
- Stages never overlap (Stage 3 complete before Stage 4 starts)
- Stage 3 brainstorm runs dynamic rounds — never a fixed count; terminate on empty objection log or stall
- Stage 4 critics run in waves of 3, never all 6 at once
- Stage 5 convergence applies least-friction tie-break; genuinely-equal trade-offs escalate to the user, never self-resolved
- Stage 7 is non-negotiable — `/team-sprint-planner` is ALWAYS invoked, never skipped
- No commit without user approval of the converged design

## Common Mistakes

| Mistake | Fix |
|---|---|
| Starting Stage 4 before Stage 3 brainstorm terminates | Lead must confirm the objection log is empty or stalled first |
| Running all 6 critics at once | Strictly enforce two waves of 3 (wave 1: technical + sceptical + time-to-think; wave 2: roi + emotional-onboarding + content-layout-expert) |
| Self-resolving a genuinely-equal trade-off in Stage 5 | Escalate to the user — least-friction only breaks ties, it does not override user preference |
| Skipping `/team-sprint-planner` in Stage 7 | The handoff is mandatory — this team produces a design, not code |
| Letting ui-designer and ux-architect agree too early | The pair is adversarial by design; agreement without challenge is a failure mode |
| Using design-research team when you need this team | design-research = research brief only. ux-challenge = converged design + plan |
