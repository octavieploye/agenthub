# MANIFEST — UX Challenge Workflow
Version: 1.0
Modes: WEBSITE | APPLICATION
Lightweight: true

## Purpose

Adversarial UX↔UI design workflow. Takes a target category and produces a converged, user-friendly website/marketplace design — competitor research → trend extraction → tight brief → adversarial UX↔UI pair → 6 concurrent critics → least-friction convergence → plan → sprint handoff.

**Key Innovation:** The UX↔UI pair argues before critics attack. Six persona-critics run in waves of 3. Convergence applies a least-friction tie-break, escalating genuinely-equal trade-offs to the user.

## LOAD ORDER

1. Load the team config `.claude/teams/ux-challenge/config.json` first (roster + concurrency policy)
2. Load the orchestrator `lead-ux-challenge` command at session start
3. Load one stage's command(s) at a time — unload previous before loading next
4. Load `persona-panel` command before Stage 4 (critics read the 4-persona definition)
5. Load `synthesis/handoff.md` when all stages complete

## BEFORE STARTING — MANDATORY

Present user with mode question:
> "Are we designing a **WEBSITE** (marketing/landing/marketplace) or an **APPLICATION** (product UI/dashboard)?"

- `WEBSITE` → conversion-first: above-the-fold, social proof, pricing, CTA flow
- `APPLICATION` → task-first: navigation, state visibility, progressive disclosure, zero-config defaults

USER CONFIRMATION GATE after Stage 0 — do not begin Stage 1 without explicit user approval of category + mode + repo target.

## CORE (always load)

core/design-principles.md     Universal research standards and non-assumption rules
core/persona-panel.md         The 4 emotional buyer personas (Technical, Sceptical, Time-to-Think, ROI)

## STAGE MODULES (run in order)

  stage-0-intake.md            S0   lead-ux-challenge: category, mode, brand constraints, repo target
  stage-1-research.md          S1   competitor-trend-researcher: websearch + chrome-devtools MCP trend extraction
  stage-2-tight-brief.md       S2   lead-ux-challenge: compress trend brief into tight brief
  stage-3-adversarial-pair.md  S3   ux-architect + ui-designer: dynamic brainstorm rounds (2 active)
  stage-4-critique.md          S4   6 critics in two waves of 3 (wave 1: technical + sceptical + time-to-think; wave 2: roi + emotional-onboarding + content-layout-expert)
  stage-5-convergence.md       S5   lead-ux-challenge: least-friction tie-break, escalate equal trade-offs
  stage-6-plan.md              S6   lead-ux-challenge: lock stack, write implementation plan
  stage-7-handoff.md           S7   lead-ux-challenge: ALWAYS invoke /team-sprint-planner

## SYNTHESIS

  synthesis/handoff.md    Converged design + implementation plan, structured for sprint-planner handoff

## HANDOFF

Output routes to:
- team-sprint-planner: ALWAYS — spawns team-dev-loop (builder) + frontend-design + frontend-wire-verifier (supervisors)
- team-production-readiness: final sprint before launch

## OUTPUT LOCATION

docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-converged-design.md
