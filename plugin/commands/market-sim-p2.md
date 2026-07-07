---
name: 'market-sim-p2'
description: 'Run Phase 2 of the Market Intelligence workflow: Data Analysis. Use after Phase 1 is complete and PHASE-1-OUTPUT is available. Lead: lead-data. Input: PHASE-1-OUTPUT from lead-business. Output: PHASE-2-OUTPUT for lead-stats.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY:

STEP 1 — Load the phase file:
LOAD the FULL `.claude/workflow-team-library/market-sim-prep/phase-2-data-analysis.md` and READ its entire contents.

STEP 2 — Verify that PHASE-1-OUTPUT is available. It must contain:
- Minimum 8 persona cards
- Minimum 6 competitor cards
- Market map with TAM/SAM/SOM + source
- Macro force scan
- Minimum 3 segment descriptions (F3)
- Buyer psychology maps for top 5 personas
- ceo-advisor review
- CSL items and open questions

If PHASE-1-OUTPUT is incomplete, do not proceed. Return to Phase 1 and name the specific gaps.

STEP 3 — Execute Phase 2 exactly as instructed in the phase file:
- Deposit: data-architect runs the deposit protocol on all Phase 1 components
- Opportunity scan: opportunity-analyst maps OSS cards with CS scores
- Risk scan: risk-analyst maps RSS cards with severity/probability estimates
- CSL resolution: all Phase 1 CSL flags classified as opportunities or risks
- Cross-session check: prior session records reviewed for confirmations or contradictions
- Open questions: minimum 5 specific, answerable questions for Phase 3

STEP 4 — Run Gate 2 check using `.claude/workflow-team-library/market-sim-prep/handoffs.md` before producing the PHASE-2-OUTPUT package.
Do not hand off if any gate item fails — fix first.
