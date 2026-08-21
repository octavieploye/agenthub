# MANIFEST — Website UI/UX Workflow
Version: 1.0
Modes: LINEAR (new build) | AUDIT (existing site refactor)

## Purpose

End-to-end orchestration for website creation or refactoring projects. Determines project type (new vs. existing), conducts user intake, performs competitive/trend research, applies emotional UX intelligence, and produces validated UI/UX deliverables.

**Key Innovation:** Pre-design triage gate + mandatory non-tech persona validation at every phase.

## LOAD ORDER

1. Load ALL core/ modules first (always in context)
2. lead-ui-ux-website loads phase-0-triage.md at session start
3. Load one phase module at a time — unload previous before loading next
4. Load synthesis/handoff.md when all phases complete
5. Load ops/ modules only when explicitly needed

## BEFORE STARTING — MANDATORY

Present user with triage question:
> "Are we building a **new website from scratch** or **refactoring/improving an existing website**?"

If `new`: Run full intake questionnaire (phase-0-triage.md)
If `existing`: Run audit collection + Chrome DevTools MCP analysis (phase-0-audit.md)

USER CONFIRMATION GATE after Phase 0 — do not begin Phase 1 without explicit user approval of project scope.

## CORE (always load)

core/design-principles.md     Universal research standards and non-assumption rules
core/non-tech-persona.md      Alex, 48yo persona definition — cognitive load, jargon detection, discoverability

## NEW BUILD MODULES (Linear progression)

Entry: user confirms `new` project

  phase-0-triage/intake.md           P0   Brand, visual preferences, goals, content, technical constraints
  phase-1-research/trend-harvest.md  P1   competitor-trend-researcher: 2026 web design trends for this category
  phase-1-research/emotion-map.md    P1   emotion-ux: trust signals, delight, friction, onboarding arc
  phase-1-research/competitive.md    P1   competitor-auditor: 3-5 competitor analysis (optional)
  phase-1-research/persona-validate.md P1  persona-nontechuser: pre-design validation
  phase-2-ux/component-spec.md       P2   ux-architect: UX architecture, component hierarchy, accessibility
  phase-2-ux/animation-spec.md       P2   animation-engineer: Motion + GSAP patterns
  phase-2-ux/design-review.md        P2   persona-nontechuser: pre-implementation design review
  phase-3-implementation/build.md    P3   dev-frontend + animation-engineer (parallel)
  phase-3-implementation/validate.md P3   persona-nontechuser: implementation validation
  phase-4-handoff/summary.md         P4   lead-ui-ux-website: compile + user approval

## EXISTING SITE MODULES (Audit-first progression)

Entry: user confirms `existing` project

  phase-0-audit/collection.md        A0   Pain points, keep/change list, references
  phase-0-audit/chrome-devtools.md   A0   Automated DOM/color/typography/animation extraction
  phase-1-research/gap-analysis.md   A1   Compare current vs. trends + emotion patterns
  phase-2-ux/refactor-spec.md        A2   ux-architect: what to keep, what to change
  phase-3-implementation/rebuild.md  A3   dev-frontend + animation-engineer (parallel)
  phase-3-implementation/validate.md A3   persona-nontechuser: implementation validation
  phase-4-handoff/summary.md         A4   lead-ui-ux-website: compile + user approval

## SYNTHESIS

  synthesis/handoff.md    Complete UI/UX Summary — all documents structured for approval

## OPERATIONS

  ops/how-to-run               HOW/WHEN/WHY/WHAT — read by lead-ui-ux-website at session start
  ops/intake-templates         Copy/paste intake questionnaires for new + existing
  ops/data-request-list        Missing data protocol — pause and request from user

## TOKEN BUDGET GUIDE

core/ total:             ~400 tokens   (always in context)
one phase module:        ~500 tokens   (load/unload as you go)
synthesis/:              ~300 tokens   (load at end only)
Maximum in context:      ~2,200 tokens (fits any window)

## HANDOFF

Output routes to:
- team-ui-builder: if additional feature UI needed post-website
- team-design-research: if deeper trend research needed
- graphic-identity-team: if brand visual system needed
- team-content-engine: if content production needed for landing pages
- team-geo-optimizer: if AI search visibility needed

## OUTPUT LOCATION

docs/ui-builder/[YYYY-MM-DD]-[website-name]-ui-summary.md
