# MANIFEST — Upgrade Sprint Workflow
Version: 1.0
Modes: LINEAR

## Purpose

Safely upgrade major frontend dependencies (DaisyUI, Tailwind CSS, React, etc.) with full visual regression coverage. Produces an Upgrade Report with before/after component inventory, breaking change resolution log, and regression test results.

## When to Use

- Major version bump of a UI framework or CSS library (DaisyUI 3 to 4, Tailwind 3 to 4, etc.)
- Any dependency upgrade that touches component class names, theme tokens, or CSS utilities
- React/Next.js major version upgrades that affect rendering or hydration

## LOAD ORDER

1. Always load ALL core/ modules first
2. Run phases in strict order: p1 → p2 → p3 → p4
3. Lead reviews output between each phase before activating the next agent
4. No phase may start until the previous phase is approved by lead

## CORE (always load)

core/upgrade-rules.md    Universal rules for safe dependency upgrades — no silent version changes, no skipped tests

## PHASE MODULES (run in order)

phases/p1-audit.md          Phase 1 — scout-frontend: audit current versions, map all affected components and classes
phases/p2-upgrade.md        Phase 2 — dev-frontend: run upgrade, resolve breaking changes, fix class/API migrations
phases/p3-regression.md     Phase 3 — tester-frontend: visual regression tests on every affected component
phases/p4-validation.md     Phase 4 — sr-frontend: senior review of all changes, approve or reject

## SYNTHESIS

The lead compiles the Upgrade Report from all phase outputs.

## Output Location

docs/superpowers/specs/[YYYY-MM-DD]-upgrade-sprint-[dependency]-report.md

## Agents Used (from dev-stack)

| Phase | Agent | Role |
|---|---|---|
| P1 | scout-frontend | Audit current state, map affected surface |
| P2 | dev-frontend | Execute upgrade, fix breaking changes |
| P3 | tester-frontend | Visual regression tests |
| P4 | sr-frontend | Senior validation gate |

Max 3 agents active. Phases are sequential — only one agent active at a time.
