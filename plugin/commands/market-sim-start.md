---
name: 'market-sim-start'
description: 'Launch the full Market Intelligence Pre-Simulation workflow. Use when starting any new product, offer, or market-entry initiative — BEFORE running /destructuring-business. Runs all 4 phases in sequence: Business Research → Data Analysis → Statistical Validation → Market Simulation.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY:

STEP 1 — Load the workflow master manifest:
LOAD the FULL `.claude/workflow-team-library/market-sim-prep/manifest.md` and READ its entire contents.

STEP 2 — Collect the INPUT BRIEF from the user before doing anything else.
Ask the user to fill in the following. Do not proceed to Phase 1 until every field is provided:

```
WORKFLOW INPUT BRIEF
====================
Product/Service:       [name and 1-sentence description]
Market territories:    [which geo tracks to activate: FR / EU / US / GLOBAL]
Known audiences:       [list ALL personas you believe could benefit — do not filter yet]
Known competitors:     [any you are already aware of — partial is fine]
Primary question:      [the one question this workflow must answer]
Secondary questions:   [up to 3 additional questions]
Time constraint:       [how many sessions/hours available for this workflow]
Prior research:        [any data-team records from previous sessions on related topics]
```

STEP 3 — Once the INPUT BRIEF is complete, load Phase 1 and begin:
LOAD the FULL `.claude/workflow-team-library/market-sim-prep/phase-1-business-research.md` and follow its instructions exactly.

STEP 4 — Run all phases in sequence. After each phase completes its gate check, load the next phase file:
- Phase 2: `.claude/workflow-team-library/market-sim-prep/phase-2-data-analysis.md`
- Phase 3: `.claude/workflow-team-library/market-sim-prep/phase-3-stats-validation.md`
- Phase 4: `.claude/workflow-team-library/market-sim-prep/phase-4-simulation-criteria.md` (pre-offer intelligence — NOT simulation)
- Phase 5: Business strategy destructuring agents using the BUSINESS STRATEGY INPUT CONTRACT in handoffs.md — run /destructuring-business
- Phase 6: `.claude/workflow-team-library/market-sim-prep/phase-6-simulation.md` (the real simulation — 5–10 scenarios, runs AFTER /destructuring-business)

Refer to `.claude/workflow-team-library/market-sim-prep/handoffs.md` at every gate — a phase does not advance until its gate checklist passes.

IMPORTANT — sequence of simulation:
Phase 4 prepares intelligence for Business Strategy Destructuring. Phase 5 engineers the offer via /destructuring-business. Phase 6 simulates how that offer lands in 5–10 real human situations across different countries and cultural psychologies. Simulation cannot run before the offer exists.
