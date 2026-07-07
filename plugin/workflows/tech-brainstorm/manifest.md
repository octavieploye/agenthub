# MANIFEST — Tech-Brainstorm Team (Technical Ideation)
Version: 1.0
Role:    Technical ideation — from approved Idea Brief to approved Feature Brief
Scope:   agenthub, optimaeus HEAD, anamnesis, llm-workflows-pckg

---

## WHAT THE TECH-BRAINSTORM TEAM IS

The tech-brainstorm team is a separate follow-up session that activates ONLY after:
  1. The general brainstorm team has produced an approved Idea Brief
  2. The user has decided the idea should become a feature or product

It takes the Idea Brief as input and produces a Feature Brief:
  - Where the feature belongs in the Optimaeus cascade
  - 2-3 technical approaches with trade-offs
  - 2-3 UX directions with feasibility checks
  - Risk register (technical, DB, cascade, breaking changes)
  - Brain co-sign confirming no cascade violations or sovereignty issues

It does NOT re-do the brainstorm work. It starts from the Idea Brief.
It does NOT write code or implementation specs. It produces a Feature Brief only.
Dev-stack implements from the approved Feature Brief in a separate sprint.

**The Brain team co-chairs every session** — same as brainstorm.
philosophy.md is loaded at session start. Not optional.

**Dev-stack validators (architect + dev-backend) participate in Phase 5** — risk and feasibility only.
They do not build at this stage. They surface what the build team would need to know.

---

## INPUT REQUIREMENT

  Required: Approved Idea Brief (IDEA record from memory/records/brainstorm/)
  Constraint: Tech-brainstorm session CANNOT start without an approved Idea Brief.
              The Idea Brief defines scope, prior signals, and routing rationale.

---

## TEAM MEMBERS

  lead-tech-brainstorm  — session orchestrator, co-chairs with lead-brain, owns the Feature Brief
  feature-architect     — ideation architect, cascade placement, 2-3 technical approaches
  sr-backend            — senior backend ideation: APIs, DB design, migration risk, sovereignty
  sr-frontend           — senior frontend ideation: UI patterns, Electron constraints, state design
  ux-explorer           — UX ideation: 2-3 distinct UX directions before any direction is locked

## CROSS-TEAM CO-PRESENCE

  Brain team (all 5):           Co-chairs throughout. philosophy.md always loaded.
  Dev-stack (architect, dev-backend): Phase 5 validators only — no building.
  Data team (data-architect):   Phase 9 deposit — FEAT record.

---

## SESSION PHASES (summary)

  Phase 1 — BRIEF       Load Idea Brief, Brain orientation
  Phase 2 — PLACE       Map cascade placement (feature-architect + ecosystem-architect)
  Phase 3 — IDEATE      2-3 technical approaches (feature-architect + sr-backend + sr-frontend)
  Phase 4 — UX          2-3 UX directions (ux-explorer + sr-frontend feasibility check)
  Phase 5 — VALIDATE    Dev-stack risk review (architect + dev-backend — read only)
  Phase 6 — SIGNAL      Proactive Signal Protocol fires again (technical signals added)
  Phase 7 — SYNTHESIZE  Feature Brief produced + Brain co-signs
  Phase 8 — APPROVE     User approves Feature Brief
  Phase 9 — DEPOSIT     Data team deposits FEAT record

Full procedure: tech-brainstorm/ops/how-to-run.md
Feature Brief format: tech-brainstorm/ops/feature-brief-template.md

---

## PROACTIVE SIGNAL PROTOCOL (SAME OBLIGATION AS BRAINSTORM)

The full Proactive Signal Protocol applies here too (7 standard signals).
Additional technical signals fire at Phase 6:
  TECHNICALLY INFEASIBLE:  The approach cannot be built within cascade constraints
  CASCADE VIOLATION:       The approach breaks inter-entity data flow rules
  BREAKING CHANGE:         The approach breaks existing contracts without a migration path
  SOVEREIGNTY BREACH:      The approach introduces adversarial infrastructure dependency

Every concern comes with a direction. No signal without an alternative path.

---

## WHAT THE TECH-BRAINSTORM TEAM NEVER DOES

  Never starts without an approved Idea Brief from the general brainstorm team
  Never writes implementation code, migrations, or sprint specs
  Never proposes a single technical approach (always 2-3)
  Never hands off to dev-stack without explicit user approval of the Feature Brief
  Never skips Brain orientation including philosophy.md
  Never skips the Proactive Signal Protocol (Phase 6)
  Never makes final decisions (user is always the decision-maker)

---

## TOKEN BUDGET

  brain/knowledge/philosophy.md:       ~600 tokens (ALWAYS load)
  brain/knowledge/ecosystem.md:        ~600 tokens (loaded by ecosystem-architect)
  brain/knowledge/projects-current.md: ~500 tokens (loaded by project-navigator)
  Idea Brief (input):                  ~400-600 tokens (loaded by lead-tech-brainstorm)
  feature-brief-template.md:           ~500 tokens (loaded at Phase 7)
  Maximum in context at once:          ~3,200 tokens
