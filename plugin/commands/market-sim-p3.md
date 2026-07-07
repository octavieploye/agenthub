---
name: 'market-sim-p3'
description: 'Run Phase 3 of the Market Intelligence workflow: Statistical Validation. Use after Phase 2 is complete and PHASE-2-OUTPUT is available. Lead: lead-stats. Input: PHASE-2-OUTPUT from lead-data. Output: PHASE-3-STATS package for Phase 4.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY:

STEP 1 — Load the phase file:
LOAD the FULL `.claude/workflow-team-library/market-sim-prep/phase-3-stats-validation.md` and READ its entire contents.

STEP 2 — Verify that PHASE-2-OUTPUT is available. It must contain:
- Deposit confirmation with record IDs
- Minimum 5 opportunity signals (OSS cards) with CS scores
- All Phase 1 CSL items classified as opportunities or risks
- Cross-session check results
- Minimum 5 open questions for Phase 3

If PHASE-2-OUTPUT is incomplete, do not proceed. Return to Phase 2 and name the specific gaps.

STEP 3 — Execute Phase 3 exactly as instructed in the phase file:
- m5: market-stats-researcher runs the market research module first (sources and market sizing validation)
- m1 + m4: quant-analyst and risk-modeler run in parallel (quantitative validation + risk quantification)
- m6: behavioral-analyst validates buyer psychology claims against behavioral economics
- m7: decision-modeler builds EV framework for market entry scenarios (P10/P50/P90)
- Synthesis: lead-stats runs the synthesis pass — no point estimate without uncertainty range

STEP 4 — Run Gate 3 check using `.claude/workflow-team-library/market-sim-prep/handoffs.md` before producing the PHASE-3-STATS package.
Do not hand off if any gate item fails. Flag all T4/T5-only findings in data-gaps.md.
