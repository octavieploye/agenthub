---
name: 'market-sim-p4'
description: 'Run Phase 4 of the Market Intelligence workflow: Pre-Offer Intelligence. Use after Phase 3 is complete and PHASE-3-STATS is available. Synthesizes validated research into a clean intelligence package for Business Strategy Destructuring. Lead: lead-data + lead-business. Output: PHASE-4-PREOFFER package for Phase 5 (Business Strategy Destructuring via /destructuring-business).'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY:

STEP 1 — Load the phase file:
LOAD the FULL `.claude/workflow-team-library/market-sim-prep/phase-4-simulation-criteria.md` and READ its entire contents.

NOTE: Despite the filename, Phase 4 is NOT the simulation. Phase 4 is pre-offer intelligence synthesis — it prepares the package that Business Strategy Destructuring (Phase 5, /destructuring-business) needs. The market simulation runs in Phase 6, after the offer has been engineered.

STEP 2 — Verify that PHASE-3-STATS is available. It must contain:
- All market data points with trust tier + confidence score + uncertainty range (no exceptions)
- Probability models for the top 5 OSS signals
- Risk quantification with RPN and materialization probability
- Behavioral validation of Phase 1 buyer psychology claims
- Decision tree with P10/P50/P90 for minimum 2 entry options
- Data-gaps list (T4/T5-only findings)

If PHASE-3-STATS is incomplete, do not proceed. Return to Phase 3 and name the specific gaps.

STEP 3 — Execute Phase 4 exactly as instructed in the phase file:
- Build simulation models for ALL persona segments from Phase 1 (minimum 8)
- Run P10 / P50 / P90 adoption scenarios per segment
- Run competitive response models for top 3 segments
- Run sovereignty signal test per segment (sovereignty as driver vs. filter)
- Run global trends cross-check (5 forces)
- Run sensitivity analysis: top 3 most sensitive variables
- Produce cross-segment ranking table (NOT a recommendation — ranked intelligence)
- decision-modeler note: which assumptions are most fragile
- strategist note: what the simulation revealed that intuition missed

STEP 4 — Run Gate 4 check using `.claude/workflow-team-library/market-sim-prep/handoffs.md` before producing the SIMULATION-OUTPUT package.
Do not hand off to business strategy destructuring if any gate item fails.

STEP 5 — Once Gate 4 passes, produce the SIMULATION-OUTPUT package and confirm it is ready for business strategy destructuring agents. Reference the Business Strategy Input Contract in handoffs.md for how each destructuring agent (Market Position → Offer Architect → Acquisition Analyst → Unit Economics → Monetization Architect) should consume the simulation output.
